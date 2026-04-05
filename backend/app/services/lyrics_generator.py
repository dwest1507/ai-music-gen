"""
Lyrics auto-generation service using Groq API.

Called when a user submits a generation request without lyrics and without
the instrumental flag set. Returns structured lyrics with ACE-Step tags.
Falls back to empty string (ACE-Step auto-generation) on any error or when
GROQ_API_KEY is not configured.
"""

import logging

from groq import AsyncGroq

from app.core.config import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a professional songwriter writing lyrics for AI music generation with ACE-Step.

Rules:
1. Use structure tags on their own line: [Intro], [Verse], [Verse 2], [Pre-Chorus], \
[Chorus], [Bridge], [Outro], [Instrumental], [Guitar Solo], etc.
2. Keep 6-10 syllables per line. Lines in the same position should have similar counts (±2).
3. Pick ONE core metaphor and explore it throughout — no mixed metaphors.
4. Uppercase signals high energy/shouting: "WE RISE TOGETHER" vs "walking down the street".
5. Parentheses denote background vocals: "we rise (we rise)".
6. Separate sections with a blank line.
7. Avoid adjective stacking, vague filler, or forced rhymes that break meaning.
8. Lines must be singable in one breath — no run-ons.

Structure by target duration:
- ~30–60 s : [Verse] → [Chorus] → [Outro]
- ~90–120 s : [Verse] → [Chorus] → [Verse 2] → [Chorus] → [Outro]
- ~150–180 s : [Intro] → [Verse] → [Pre-Chorus] → [Chorus] → [Verse 2] → \
[Pre-Chorus] → [Chorus] → [Bridge] → [Chorus] → [Outro]
- 180 s+   : add instrumental/solo sections and extend repeats accordingly

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
        lyrics = response.choices[0].message.content or ""
        lyrics = lyrics.strip()
        logger.info("Lyrics generated successfully (%d chars)", len(lyrics))
        return lyrics
    except Exception:
        logger.exception("Lyrics auto-generation failed; falling back to ACE-Step")
        return ""
