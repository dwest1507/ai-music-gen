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


class GroqService:
    """Encapsulates interaction with Groq API for lyric writing and prompt tasks."""

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

    async def generate_lyrics(self, prompt: str) -> str:
        """Generate structured song stanzas from a musical prompt.

        Args:
            prompt: The user's description of style, mood, and topic.

        Returns:
            Formatted lyrics text with section header tags.
        """
        if not self.is_configured:
            raise RuntimeError("GroqService is not configured with an API key")

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT_LYRICS},
                {
                    "role": "user",
                    "content": f"Write song lyrics based on this description:\n{prompt}",
                },
            ],
            temperature=0.7,
        )

        content = response.choices[0].message.content or ""
        return content.strip()
