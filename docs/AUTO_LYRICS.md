Findings: Auto-Lyrics Generation in ACE-Step

  Yes, ACE-Step has auto-lyrics generation, powered by a locally-running 5Hz Language Model (Qwen-based, 0.6B/1.7B/4B variants). There are two generation paths and one fallback:

  Path 1: Simple Mode — Full auto-generation from a prompt

  - acestep/llm_inference.py:1997 → create_sample_from_query()
  - User provides only a natural language description (e.g., "a soft Bengali love song")
  - The 5Hz LM generates everything: caption, lyrics, BPM, key, duration, time signature
  - If instrumental=True, lyrics default to "[Instrumental]"

  Path 2: Format Mode — Enhancement of user-provided lyrics

  - acestep/llm_inference.py:2171 → format_sample_from_input()
  - User provides caption and/or lyrics; the LLM enhances/reformats them
  - If lyrics are empty → defaults to "[Instrumental]" before LLM processing (line 2228-2229)
  - Falls back to original input if LLM fails to generate (line 2303-2307)

  Fallback: Direct generation without LLM

  - acestep/core/generation/handler/conditioning_batch.py:59-60
  - Empty lyrics → empty string passed to DiT model → produces instrumental music
  - No auto-generation occurs; the model just treats it as instrumental

  What it does NOT use

  - No external APIs (no OpenAI/Anthropic/Gemini calls)
  - No template or pre-baked lyrics
  - Everything runs locally through the 5Hz LM

  Key takeaway

  The auto-lyrics feature requires the LLM to be loaded (ACESTEP_INIT_LLM=true). Without it, empty lyrics simply produce instrumental output. The acestep-songwriting Claude skill provides songwriting guidance but doesn't
  plug into the generation pipeline itself.
