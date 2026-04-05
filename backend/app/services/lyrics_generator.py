"""
Lyrics auto-generation service using Groq API.

Called when a user submits a generation request without lyrics and without
the instrumental flag set. Returns structured lyrics with ACE-Step tags.
Falls back to empty string (ACE-Step auto-generation) on any error or when
GROQ_API_KEY is not configured.
"""

import logging
import re

from groq import AsyncGroq

from app.core.config import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a professional songwriter writing lyrics for AI music generation with ACE-Step.

## Available Tags

Structure tags go on their own line. You may combine a tag with one style hint \
using a dash: [Chorus - anthemic].

- **Structure**: [Intro], [Verse], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Outro]
- **Dynamic**: [Build], [Drop], [Breakdown]
- **Instrumental**: [Instrumental], [Guitar Solo], [Piano Interlude]
- **Vocal style**: [raspy vocal], [whispered], [falsetto], [powerful belting], \
[spoken word], [harmonies], [ad-lib]
- **Energy / emotion**: [high energy], [low energy], [building energy], [explosive], \
[melancholic], [euphoric], [dreamy], [aggressive]
- **Special**: [Fade Out], [Silence]

## Rules

1. Keep 6-10 syllables per line. Lines in the same position across sections should \
have similar counts (±2).
2. Pick ONE core metaphor and explore it throughout — no mixed metaphors.
3. Uppercase signals high energy/shouting: "WE RISE TOGETHER" vs "walking down the street".
4. Parentheses denote background vocals: "we rise (we rise)".
5. Separate sections with a blank line.
6. Avoid adjective stacking, vague filler, or forced rhymes that break meaning.
7. Lines must be singable in one breath — no run-ons.
8. Use vocal style and energy tags sparingly to guide vocal delivery and dynamics \
where it matters most — not on every section.
9. Match the energy arc of the lyrics to what makes sense for the genre. E.g., a \
ballad should build gradually; an EDM track can open with [high energy].

## Structure by Target Duration

Estimate ~5-10 s for intro/outro, ~5-15 s for instrumental breaks. Slower BPM \
needs more duration for the same lyrics.

- ~30-60 s  : [Verse] → [Chorus] → [Outro]
- ~90-120 s : [Verse] → [Chorus] → [Verse 2] → [Chorus] → [Outro]
- ~150-180 s: [Intro] → [Verse] → [Pre-Chorus] → [Chorus] → [Verse 2] → \
[Pre-Chorus] → [Chorus] → [Bridge] → [Chorus] → [Outro]
- 180 s+    : add instrumental/solo sections and extend repeats accordingly

Output ONLY the lyrics with structure tags — no explanations, no titles, no commentary.\
"""

_LANGUAGE_NAMES: dict[str, str] = {
    "bn": "Bengali",
    "zh": "Chinese (Mandarin)",
    "en": "English",
    "fr": "French",
    "de": "German",
    "he": "Hebrew",
    "hu": "Hungarian",
    "ja": "Japanese",
    "ko": "Korean",
    "ms": "Malay",
    "pl": "Polish",
    "pt": "Portuguese",
    "es": "Spanish",
}


_STRUCTURE_TAG_RE = re.compile(r"^\[[A-Za-z].*\]$", re.MULTILINE)


def _clean_lyrics(raw: str) -> str:
    """Strip preamble, markdown fences, and trailing commentary from LLM output."""
    text = raw.strip()

    # Remove markdown code fences (```lyrics ... ``` or ``` ... ```)
    text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    text = text.strip()

    # Drop lines before the first structure tag like [Verse], [Intro], etc.
    match = _STRUCTURE_TAG_RE.search(text)
    if not match:
        return ""
    text = text[match.start() :]

    # Drop trailing commentary after the last lyrics section.
    # Strategy: walk line by line. A [Tag] opens a section. Non-blank lines
    # directly after a tag (no blank separator) are lyrics. Once we hit a
    # blank line, the next non-blank line must be a [Tag] to continue;
    # otherwise it's commentary and we stop.
    lines = text.split("\n")
    last_good = 0
    after_blank = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if _STRUCTURE_TAG_RE.match(stripped):
            after_blank = False
            last_good = i
        elif not stripped:
            after_blank = True
        elif after_blank:
            # Non-blank, non-tag line after a blank gap — commentary
            break
        else:
            # Lyric content line directly under a tag (no blank separator)
            last_good = i

    text = "\n".join(lines[: last_good + 1]).rstrip()

    return text


async def generate_lyrics(
    prompt: str,
    duration: float = 60.0,
    genre: str | None = None,
    vocal_language: str = "en",
    bpm: int | None = None,
    key_scale: str | None = None,
) -> str:
    """
    Auto-generate structured song lyrics using Groq (openai/gpt-oss-120b).

    Returns the generated lyrics string on success, or an empty string when
    GROQ_API_KEY is absent or the call fails — allowing ACE-Step to fall back
    to its own built-in lyrics generation.
    """
    if not settings.GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not configured; skipping lyrics pre-generation")
        return ""

    parts: list[str] = [f'Music description: "{prompt}"']
    if genre:
        parts.append(f"Genre: {genre}")
    if bpm:
        parts.append(f"BPM: {bpm}")
    if key_scale:
        parts.append(f"Key/Scale: {key_scale}")
    parts.append(f"Target duration: ~{int(duration)} seconds")
    lang_name = _LANGUAGE_NAMES.get(vocal_language, "English")
    parts.append(f"Lyrics language: {lang_name}")
    parts.append("\nWrite the song lyrics.")

    user_message = "\n".join(parts)

    try:
        logger.info("Generating lyrics via Groq for prompt: %.80s", prompt)
        client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        response = await client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=1,
            max_completion_tokens=2048,
            top_p=1,
            reasoning_effort="medium",
            stream=False,
        )
        raw = response.choices[0].message.content or ""
        lyrics = _clean_lyrics(raw)
        if not lyrics:
            logger.warning(
                "Lyrics cleaning produced empty result from raw (%d chars)", len(raw)
            )
            return ""
        logger.info("Lyrics generated successfully (%d chars)", len(lyrics))
        return lyrics
    except Exception:
        logger.exception("Lyrics auto-generation failed; falling back to ACE-Step")
        return ""
