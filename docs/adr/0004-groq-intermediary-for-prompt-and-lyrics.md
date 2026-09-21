---
status: accepted
---

# Use Groq as an LLM intermediary for song lyric generation and review

Allowing visitors to generate songs with vocals without writing lyrics by hand required
an automated lyric generation mechanism. Relying on upstream ACE-Step's internal 5Hz LM
`sample_mode` presented significant drawbacks: it runs on the GPU container only after
job submission, cannot be reviewed or edited by the user, suffers from unpredictable
formatting, and frequently overwrites user prompt descriptions (see ADR 0003).

We now introduce an external, fast LLM intermediary via Groq (`openai/gpt-oss-120b`)
to write structured song stanzas (`[Verse]`, `[Chorus]`, etc.) directly into an editable
textarea in Step 3 of the progressive creation wizard before generation is submitted.

## Considered Options

- **Rely on ACE-Step's internal 5Hz LM (`sample_mode=True`)** — rejected. The visitor has
  no visibility into the generated lyrics before the track renders, cannot fix rhymes or
  typos, and is subjected to opaque prompt expansions.
- **Client-side LLM calls directly from the browser** — rejected. Exposing API tokens to
  the client breaks security, prevents central rate-limiting (10/min), and bypasses backend
  validation.
- **FastAPI backend proxy to Groq via `GroqService`** (chosen). Encapsulates `AsyncGroq`
  behind a clean backend service (`POST /api/generate-lyrics`). Explicitly generates
  stanzas on transition to Step 3, presents them in an editable textarea, caches them
  across back/forward wizard navigation, and discards example lyrics when the prompt is edited.
  - **Auto-Formatting for Edited Lyrics** (`POST /api/format-lyrics`): When a visitor edits
    AI-generated or pre-cached lyrics, the wizard auto-formats the edited text on submission
    by calling a separate formatting endpoint that applies section header tags (`[Verse]`,
    `[Chorus]`, `[Bridge]`, etc.) without altering any of the user's words. Formatting uses
    a low sampling temperature (`0.2`) to preserve fidelity. Lyrics identical to the pristine
    AI/example output skip the call entirely. If formatting fails, is rate limited, or exceeds
    a 10-second client-side timeout, the wizard silently falls back to submitting the raw
    edited text.
  - **Prompt Enhancement** (`POST /api/enhance-prompt`): Step 1 offers an "Enhance Prompt"
    button that rewrites the prompt in place with tempo, instrumentation, and mood detail.
    Enhancement is capped at three attempts per song, tracked in the wizard and mirrored by a
    server-side `attempt <= 3` bound because the backend is stateless. Later attempts send the
    visitor's original wording and treat the previous result as something to differ from, so
    repeated clicks produce variations rather than compounding into a verbose paragraph.
    "Revert to Original" restores the typed text without spending an attempt. The counter
    survives back/forward navigation and resets only when "Generate Another Song" remounts
    the wizard. A `503` disables the button with a tooltip; other failures show an inline
    error and spend no attempt.

## Consequences

- Visitors see their lyrics and can freely tweak words, delete lines, or clear the box to
  fall back to an instrumental track (`[Instrumental]` with `instrumental=True`).
- Submission completely bypasses ACE-Step's `sample_mode`: explicit lyrics are always sent
  with `sample_mode=False`.
- Edited lyrics are auto-formatted before submission to ensure ACE-Step receives properly
  structured section tags, with a silent fallback to raw text on formatting failure.
- If `GROQ_API_KEY` is not configured, the endpoint returns HTTP 503, and the frontend
  degrades gracefully to manual lyric entry.
- Rate limiting is enforced at 10 requests per minute per IP for lyric generation and prompt
  enhancement, and 15 requests per minute per IP for lyric formatting.
