"""Tests for the Groq-based lyrics auto-generation service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.lyrics_generator import generate_lyrics, _clean_lyrics


# ── _clean_lyrics unit tests ─────────────────────────────────────


class TestCleanLyrics:
    def test_clean_output_unchanged(self):
        """Clean lyrics with only structure tags pass through unchanged."""
        text = "[Verse]\nWalking through the rain\n\n[Chorus]\nWe rise again"
        assert _clean_lyrics(text) == text

    def test_strips_preamble_before_first_tag(self):
        """Lines before the first [Tag] are removed."""
        raw = "Here are the lyrics:\n\n[Verse]\nHello world\n\n[Chorus]\nLa la la"
        assert _clean_lyrics(raw) == "[Verse]\nHello world\n\n[Chorus]\nLa la la"

    def test_strips_markdown_code_fences(self):
        """Markdown ``` fences are removed."""
        raw = "```\n[Verse]\nHello\n\n[Chorus]\nWorld\n```"
        assert _clean_lyrics(raw) == "[Verse]\nHello\n\n[Chorus]\nWorld"

    def test_strips_markdown_code_fences_with_language(self):
        """Markdown ```lyrics fences are removed."""
        raw = "```lyrics\n[Verse]\nHello\n```"
        assert _clean_lyrics(raw) == "[Verse]\nHello"

    def test_strips_trailing_commentary(self):
        """Commentary after the last lyric section is removed."""
        raw = "[Verse]\nHello world\n\nFeel free to adjust these lyrics as needed!"
        assert _clean_lyrics(raw) == "[Verse]\nHello world"

    def test_strips_both_preamble_and_postamble(self):
        """Both preamble and trailing commentary are stripped."""
        raw = (
            "Here's a song for you:\n\n[Verse]\nWalking down\n\n"
            "[Chorus]\nWe shine\n\nHope you like it!"
        )
        assert _clean_lyrics(raw) == "[Verse]\nWalking down\n\n[Chorus]\nWe shine"

    def test_preserves_multiple_sections(self):
        """Multiple sections with blank separators are preserved."""
        raw = (
            "[Intro]\n\n[Verse]\nLine one\nLine two\n\n"
            "[Chorus]\nChorus line\n\n[Outro]\nFade out"
        )
        assert _clean_lyrics(raw) == raw.strip()

    def test_returns_empty_for_no_tags(self):
        """If there are no structure tags at all, return empty string."""
        raw = "This is just a paragraph about music with no tags."
        assert _clean_lyrics(raw) == ""

    def test_handles_whitespace_only(self):
        """Whitespace-only input returns empty string."""
        assert _clean_lyrics("   \n\n  ") == ""

    def test_handles_empty_string(self):
        """Empty string returns empty string."""
        assert _clean_lyrics("") == ""

    def test_title_line_before_tag(self):
        """A title like 'Song Title' before the first tag is stripped."""
        raw = "**Midnight Rain**\n\n[Verse]\nDrops on the window"
        assert _clean_lyrics(raw) == "[Verse]\nDrops on the window"

    def test_instrumental_tag_preserved(self):
        """[Instrumental] and similar tags are preserved."""
        raw = "[Intro]\n\n[Instrumental]\n\n[Verse]\nHello"
        assert _clean_lyrics(raw) == raw

    def test_guitar_solo_tag_preserved(self):
        """[Guitar Solo] tags are preserved."""
        raw = "[Verse]\nHello\n\n[Guitar Solo]\n\n[Outro]\nGoodbye"
        assert _clean_lyrics(raw) == raw


@pytest.mark.asyncio
async def test_generate_lyrics_returns_empty_when_no_api_key():
    """When GROQ_API_KEY is not set, generate_lyrics returns empty string."""
    with patch("app.services.lyrics_generator.settings") as mock_settings:
        mock_settings.GROQ_API_KEY = ""
        result = await generate_lyrics(prompt="A jazz ballad")
    assert result == ""


@pytest.mark.asyncio
async def test_generate_lyrics_returns_lyrics_on_success():
    """When Groq responds successfully, lyrics are returned."""
    expected = "[Verse]\nWalking through the rain\n\n[Chorus]\nWe rise again"

    mock_message = MagicMock()
    mock_message.content = expected
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with (
        patch("app.services.lyrics_generator.settings") as mock_settings,
        patch("app.services.lyrics_generator.AsyncGroq", return_value=mock_client),
    ):
        mock_settings.GROQ_API_KEY = "test-key"  # pragma: allowlist secret
        result = await generate_lyrics(prompt="A jazz ballad")

    assert result == expected


@pytest.mark.asyncio
async def test_generate_lyrics_strips_whitespace():
    """Returned lyrics are stripped of leading/trailing whitespace."""
    mock_message = MagicMock()
    mock_message.content = "  \n[Verse]\nHello world\n  "
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with (
        patch("app.services.lyrics_generator.settings") as mock_settings,
        patch("app.services.lyrics_generator.AsyncGroq", return_value=mock_client),
    ):
        mock_settings.GROQ_API_KEY = "test-key"  # pragma: allowlist secret
        result = await generate_lyrics(prompt="A pop song")

    assert result == "[Verse]\nHello world"


@pytest.mark.asyncio
async def test_generate_lyrics_returns_empty_on_groq_error():
    """When Groq raises an exception, generate_lyrics falls back to empty string."""
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(
        side_effect=Exception("Network error")
    )

    with (
        patch("app.services.lyrics_generator.settings") as mock_settings,
        patch("app.services.lyrics_generator.AsyncGroq", return_value=mock_client),
    ):
        mock_settings.GROQ_API_KEY = "test-key"  # pragma: allowlist secret
        result = await generate_lyrics(prompt="A rock anthem")

    assert result == ""


@pytest.mark.asyncio
async def test_generate_lyrics_returns_empty_when_content_is_none():
    """When Groq returns None content, generate_lyrics returns empty string."""
    mock_message = MagicMock()
    mock_message.content = None
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with (
        patch("app.services.lyrics_generator.settings") as mock_settings,
        patch("app.services.lyrics_generator.AsyncGroq", return_value=mock_client),
    ):
        mock_settings.GROQ_API_KEY = "test-key"  # pragma: allowlist secret
        result = await generate_lyrics(prompt="Ambient soundscape")

    assert result == ""


@pytest.mark.asyncio
async def test_generate_lyrics_passes_all_context_to_groq():
    """All music parameters are included in the prompt sent to Groq."""
    mock_message = MagicMock()
    mock_message.content = "[Chorus]\ntest"
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with (
        patch("app.services.lyrics_generator.settings") as mock_settings,
        patch("app.services.lyrics_generator.AsyncGroq", return_value=mock_client),
    ):
        mock_settings.GROQ_API_KEY = "test-key"  # pragma: allowlist secret
        await generate_lyrics(
            prompt="Upbeat electronic dance",
            duration=120.0,
            genre="Electronic",
            vocal_language="es",
            bpm=128,
            key_scale="C Major",
        )

    call_kwargs = mock_client.chat.completions.create.call_args
    messages = call_kwargs[1]["messages"]
    user_content = messages[1]["content"]

    assert "Upbeat electronic dance" in user_content
    assert "Electronic" in user_content
    assert "128" in user_content
    assert "C Major" in user_content
    assert "120" in user_content
    assert "Spanish" in user_content


@pytest.mark.asyncio
async def test_generate_lyrics_unknown_language_defaults_to_english():
    """An unrecognised language code defaults to English in the prompt."""
    mock_message = MagicMock()
    mock_message.content = "[Verse]\nTest"
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_response = MagicMock()
    mock_response.choices = [mock_choice]

    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

    with (
        patch("app.services.lyrics_generator.settings") as mock_settings,
        patch("app.services.lyrics_generator.AsyncGroq", return_value=mock_client),
    ):
        mock_settings.GROQ_API_KEY = "test-key"  # pragma: allowlist secret
        await generate_lyrics(prompt="A song", vocal_language="xx")

    call_kwargs = mock_client.chat.completions.create.call_args
    messages = call_kwargs[1]["messages"]
    user_content = messages[1]["content"]
    assert "English" in user_content
