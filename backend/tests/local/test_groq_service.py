import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.groq_service import GroqService


def test_groq_service_is_configured_false_when_empty_key():
    service = GroqService(api_key="")
    assert service.is_configured is False


def test_groq_service_is_configured_true_with_key():
    service = GroqService(api_key="gsk_valid_key_123")
    assert service.is_configured is True


@pytest.mark.asyncio
async def test_groq_service_generate_lyrics_raises_when_not_configured():
    service = GroqService(api_key="")
    with pytest.raises(RuntimeError, match="GroqService is not configured"):
        await service.generate_lyrics("Test prompt")


@pytest.mark.asyncio
async def test_groq_service_generate_lyrics_calls_completions():
    service = GroqService(api_key="gsk_test_key", model="openai/gpt-oss-120b")
    mock_client = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = "[Verse 1]\nLyrics generated"
    mock_resp = MagicMock()
    mock_resp.choices = [mock_choice]
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)
    service.client = mock_client

    result = await service.generate_lyrics("An indie rock anthem")
    assert result == "[Verse 1]\nLyrics generated"
    mock_client.chat.completions.create.assert_awaited_once()
    call_kwargs = mock_client.chat.completions.create.call_args.kwargs
    assert call_kwargs["model"] == "openai/gpt-oss-120b"
    assert call_kwargs["temperature"] == 0.7
    assert len(call_kwargs["messages"]) == 2
    assert "An indie rock anthem" in call_kwargs["messages"][1]["content"]
