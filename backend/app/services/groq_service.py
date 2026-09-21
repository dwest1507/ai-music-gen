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

    async def generate_lyrics(self, prompt: str) -> str:
        """Generate structured song stanzas from a musical prompt.

        Args:
            prompt: The user's description of style, mood, and topic.

        Returns:
            Formatted lyrics text with section header tags.
        """
        return await self._chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_LYRICS},
                {
                    "role": "user",
                    "content": f"Write song lyrics based on this description:\n{prompt}",
                },
            ],
            temperature=0.7,
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
