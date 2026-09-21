import logging
from typing import Optional
from groq import AsyncGroq

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_LYRICS = """You are an expert songwriter and lyricist.
Your task is to write complete, expressive, and compelling song lyrics inspired by the user's prompt (which describes the musical style, mood, instrumentation, and narrative theme).

Requirements:
1. Structure the lyrics into clearly labeled sections with tags on their own line:
   [Verse 1]
   [Chorus]
   [Verse 2]
   [Chorus]
   [Bridge]
   [Chorus]
   [Outro]
2. Ensure rhythm, rhyming, and cadence match the vibe and genre described.
3. Output ONLY the lyrics with their section headers. Do NOT include any intro explanations, preamble, or conversational commentary.
"""

SYSTEM_PROMPT_FORMAT_LYRICS = """You are a lyrics formatting assistant.
Your ONLY job is to add structural section headers ([Verse], [Chorus], [Bridge], [Outro], etc.) and clean line breaks to the user's lyrics.

Rules:
1. Do NOT alter, rewrite, paraphrase, or remove ANY of the user's words.
2. Do NOT add new lyrics, phrases, or filler text.
3. Insert section header tags (e.g. [Verse 1], [Chorus], [Bridge], [Outro]) on their own line before each section.
4. Add a blank line between sections for readability.
5. Output ONLY the formatted lyrics. No explanations, preamble, or commentary.
"""

SYSTEM_PROMPT_ENHANCE = """You are an expert music producer who writes prompts for a text-to-music model.
Your task is to rewrite the user's song idea as one rich, concise prompt that keeps their subject matter and adds musical detail.

Requirements:
1. Keep the user's genre, mood and narrative subject. Never drop or change what the song is about.
2. Add specific tempo (BPM), instrumentation, production and mood descriptors suited to the genre.
3. Write a single paragraph of at most 600 characters. No lists, headings or line breaks.
4. Output ONLY the rewritten prompt. Do NOT include explanations, preamble, quotation marks or commentary.
"""

REGENERATION_TEMPERATURE = 0.85

REGENERATION_INSTRUCTIONS = """The user was not satisfied with these earlier lyrics:

<previous_lyrics>
{previous_lyrics}
</previous_lyrics>

Write a distinctly different take on the same description. Use a different narrative
angle, fresh metaphors and imagery, a different rhyme scheme, and new hooks. Do NOT
reuse lines, rhymes, or the chorus hook from the earlier lyrics."""


class GroqService:
    """Encapsulates interaction with Groq API for lyric writing and formatting tasks."""

    def __init__(self, api_key: str = "", model: str = "openai/gpt-oss-120b"):
        self.api_key = api_key.strip()
        self.model = model
        self.client: Optional[AsyncGroq] = (
            AsyncGroq(api_key=self.api_key) if self.api_key else None
        )

    @property
    def is_configured(self) -> bool:
        """Check whether the Groq client has an active API key."""
        return bool(self.client and self.api_key)

    async def close(self) -> None:
        """Release the underlying HTTP connection pool.

        AsyncGroq wraps its own httpx client, so a service that outlives the app
        without this leaks the pool. Idempotent, and a no-op when no key was set.
        """
        if self.client is None:
            return
        client, self.client = self.client, None
        await client.close()

    async def _chat_completion(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
    ) -> str:
        """Execute a chat completion with Groq and return stripped content.

        Args:
            messages: List of role/content dictionaries.
            temperature: Sampling temperature for generation.

        Returns:
            The stripped content text from the LLM.
        """
        if not self.is_configured:
            raise RuntimeError("GroqService is not configured with an API key")

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
        )

        content = response.choices[0].message.content or ""
        return content.strip()

    async def generate_lyrics(
        self, prompt: str, previous_lyrics: Optional[str] = None
    ) -> str:
        """Generate structured song stanzas from a musical prompt.

        Args:
            prompt: The user's description of style, mood, and topic.
            previous_lyrics: Lyrics from an earlier take. When given, the model is
                told to write something contrasting and sampled at a higher
                temperature for more varied phrasing.

        Returns:
            Formatted lyrics text with section header tags.
        """
        user_content = f"Write song lyrics based on this description:\n{prompt}"
        temperature = 0.7
        if previous_lyrics and previous_lyrics.strip():
            user_content += "\n\n" + REGENERATION_INSTRUCTIONS.format(
                previous_lyrics=previous_lyrics.strip()
            )
            temperature = REGENERATION_TEMPERATURE

        return await self._chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_LYRICS},
                {"role": "user", "content": user_content},
            ],
            temperature=temperature,
        )

    async def format_lyrics(self, lyrics: str) -> str:
        """Format custom or edited lyrics with section header tags without modifying words.

        Args:
            lyrics: The user's raw or edited lyric text.

        Returns:
            The lyrics formatted with section tags ([Verse], [Chorus], etc.) and clean line breaks.
        """
        return await self._chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_FORMAT_LYRICS},
                {
                    "role": "user",
                    "content": (
                        f"Format these lyrics into structured sections without altering "
                        f"any of the words:\n\n{lyrics.strip()}"
                    ),
                },
            ],
            temperature=0.2,
        )

    async def enhance_prompt(
        self,
        prompt: str,
        attempt: int = 1,
        original_prompt: Optional[str] = None,
    ) -> str:
        """Expand a song idea with tempo, instrumentation and mood descriptors.

        The first attempt enhances `prompt` as typed. Later attempts start again from
        `original_prompt` and treat `prompt` (the previous enhancement) as something to
        differ from, so repeated clicks yield variations rather than a snowballing
        paragraph.

        Args:
            prompt: The text currently in the prompt box.
            attempt: 1-based enhancement attempt for this song.
            original_prompt: What the visitor typed before any enhancement.

        Returns:
            A single enriched prompt that keeps the original subject matter.
        """
        if attempt > 1 and original_prompt:
            content = (
                f"Enhance this song prompt:\n{original_prompt}\n\n"
                f"Write an alternative variation with a different sonic palette and "
                f"feel from this earlier attempt:\n{prompt}"
            )
            temperature = 0.9
        else:
            content = f"Enhance this song prompt:\n{prompt}"
            temperature = 0.7

        return await self._chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_ENHANCE},
                {"role": "user", "content": content},
            ],
            temperature=temperature,
        )
