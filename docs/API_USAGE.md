# Reference: API Endpoints

The AI Music Generation backend acts as a stateless HTTP proxy over the ACE-Step Modal API.

## Core Generation Endpoints

### `POST /api/generate`
Submits a new music generation task.

**Lyrics resolution order (backend):**
1. `instrumental: true` → forces `[Instrumental]` (no vocals)
2. `lyrics` provided (> 5 non-whitespace chars) → uses the supplied lyrics as-is
3. No lyrics + not instrumental → the request is sent with `sample_mode: true` and a
   `sample_query` taken from `topic` (falling back to the genre-prefixed prompt),
   delegating lyrics writing to ACE-Step's built-in 5Hz language model.

**Two text channels.** `prompt` is the *style* caption — instrumentation, timbre, mix,
mood — and `topic` is what the song is *about*. They are kept apart because an ACE-Step
caption has no channel to the vocals, so subject matter placed there is lost. See
docs/archive/SPEC.md FR-20 and ADR 0003.

`use_format` is no longer a request field (any value sent is ignored): it made the 5Hz
LM rewrite the caption and lyrics together, which paraphrased auto-lyrics twice and
overwrote hand-written ones. The backend now sends it off. A terse caption (under six words) is instead expanded by a
separate `/format_input` call that is sent empty lyrics and whose output is kept only as
the caption, so the expansion can never touch anyone's words. See docs/archive/SPEC.md §8.1.

**Request Body:**

`prompt` is the only required field. The web UI sends just `prompt`, `topic`, `genre`,
`duration`, `lyrics`, `vocal_language`, and `instrumental`; everything else falls back to
quality-tuned defaults. Omitting `duration` lets the model pick a length, which can come
out shorter than long lyrics need — set it explicitly if lyrics are being cut off.

```json
{
  "prompt": "Epic orchestral score",
  "topic": "a long journey home",
  "lyrics": "Optional lyrics here",
  "instrumental": false,
  "genre": "Soundtrack",
  "vocal_language": "en",
  "duration": 60,
  "audio_format": "mp3",
  "thinking": true,
  "use_cot_caption": false,
  "use_cot_language": false,
  "lm_temperature": 0.7,
  "bpm": 120,
  "key_scale": "C Major",
  "time_signature": "4/4",
  "inference_steps": 8,
  "batch_size": 1
}
```

**Response (202 Accepted):**
```json
{
  "task_id": "uuid-string",
  "status": "queued",
  "queue_position": 1
}
```

### `GET /api/jobs/{task_id}`
Checks the status of a previously submitted task.

**Response:**
```json
{
  "task_id": "uuid-string",
  "status": "queued|processing|completed|failed",
  "audio_url": "/api/audio/{task_id}?path=...",
  "metadata": {
    "prompt": "...",
    "duration": 60,
    "bpm": 120
  },
  "error": "Optional error message if failed"
}
```

### `GET /api/audio/{task_id}`
Proxies the audio download from the upstream Modal API. The `path` query parameter is obtained from the job status payload.

---

## Utility Endpoints

### `GET /api/models`
Returns the list of DiT models available on the connected ACE-Step API instance.

### `POST /api/random-sample`
Returns realistic, random parameters for a generation request. An upstream passthrough; the
wizard does not call it — it uses `GET /api/examples/random` instead.

### `POST /api/format`
Enhances formatting of user prompts or lyrics via an upstream language model.

### `GET /api/examples/random`
Returns one curated example, drawn at random from `backend/examples/text2music/`, shaped for
the wizard's Step 1. The pool is filtered to examples that are English **and** carry lyrics, so
`vocal_language` is always `"en"` and `instrumental` is always `false`; the wizard pre-caches
the returned `lyrics` so choosing "Song with Lyrics" needs no Groq call. The qualifying set is
parsed once per process, so a newly added example file requires a restart.

```json
{
  "prompt": "An upbeat indie track with sparkling guitars",
  "lyrics": "[Verse 1]\nWalking down the sunny street...",
  "vocal_language": "en",
  "instrumental": false
}
```

**Errors:** `404` when the examples directory is missing or holds no qualifying example.

> **Groq-backed endpoints** (`generate-lyrics`, `format-lyrics`, `enhance-prompt`) share an error
> contract. A `502` body carries a fixed message — `"Lyric generation failed"`, `"Lyric formatting
> failed"`, `"Prompt enhancement failed"` — and never the provider's own error text, which can name
> the org, key prefix and request id. The underlying exception goes to the backend log instead. Do
> not parse `detail` to distinguish upstream causes; treat any `502` as "try again".

### `POST /api/generate-lyrics`
Generates structured song lyrics (`[Verse]`, `[Chorus]`, etc.) using Groq LLM based on user prompt.

**Rate limit:** 10 requests per minute per IP.

**Request Body:**
```json
{
  "prompt": "an upbeat synthwave song about neon nights",
  "previous_lyrics": null
}
```

| Field | Notes |
|---|---|
| `prompt` | Song description (1-1000 chars). |
| `previous_lyrics` | Optional, up to 5000 chars. Send the lyrics from an earlier take to request a regeneration: the model is told to write a contrasting take (different narrative angle, imagery, rhyme scheme, and hooks, with no reused lines) and samples at a higher temperature (`0.85` instead of `0.7`). |

**Response (200 OK):**
```json
{
  "lyrics": "[Verse 1]\nCruising down the electric avenue..."
}
```

The three-regeneration cap per prompt is enforced in the wizard, not by the backend, which is stateless; the rate limit above is the server-side bound.

**Errors:** `422` for an empty/whitespace-only prompt, `503` when `GROQ_API_KEY` is not configured,
`502` when Groq fails.

### `POST /api/format-lyrics`
Formats user-written or edited lyrics into structured sections with header tags (`[Verse]`, `[Chorus]`, `[Bridge]`, etc.) without altering any of the user's words. Used as an auto-formatting step before generation when lyrics have been manually edited.

**Rate limit:** 15 requests per minute per IP.

**Request Body:**
```json
{
  "lyrics": "walking through the city lights\nfeel the beat tonight\noh oh oh\nwalking through the city lights"
}
```

**Response (200 OK):**
```json
{
  "lyrics": "[Verse 1]\nWalking through the city lights\nFeel the beat tonight\n\n[Chorus]\nOh oh oh\nWalking through the city lights"
}
```

**Errors:** `422` for empty/whitespace-only lyrics (max 5000 chars), `503` when `GROQ_API_KEY` is
not configured, `502` when Groq fails. The frontend treats any failure (or a 10s timeout) as a
signal to submit the raw edited lyrics instead, so formatting never blocks generation.

### `POST /api/enhance-prompt`
Rewrites a song prompt with tempo, instrumentation, production, and mood detail using Groq, keeping the original genre and subject matter. The wizard replaces the prompt text in place and offers a one-click revert.

**Rate limit:** 10 requests per minute per IP.

**Request Body:**
```json
{
  "prompt": "Make a pop punk song about being a dad",
  "attempt": 1,
  "original_prompt": null
}
```

| Field | Notes |
|---|---|
| `prompt` | Text currently in the prompt box (1-1000 chars). |
| `attempt` | 1-based enhancement number for this song, `1`-`3`. Defaults to `1`; a fourth attempt is refused with `422`. |
| `original_prompt` | What the visitor typed before any enhancement. Optional; send it on attempt 2+. |

Attempt 1 enhances `prompt` as typed. On attempt 2+ with `original_prompt`, the model starts again from the original and treats `prompt` (the previous enhancement) as something to differ from, at a higher temperature (`0.9`). Repeated clicks therefore yield alternative variations instead of an ever-longer paragraph.

**Response (200 OK):**
```json
{
  "prompt": "Pop punk, 180 BPM, distorted power chords, punchy drums, anthemic and heartfelt about fatherhood"
}
```

**Errors:** `422` for empty/whitespace-only prompts or `attempt` outside `1`-`3`, `503` when `GROQ_API_KEY` is
not configured, `502` when Groq fails. The frontend disables the button with a tooltip on `503` and shows an
inline error on other failures without spending an attempt, so enhancement never blocks the wizard.

### `GET /health`
Returns system health, including the connection status to the upstream ACE-Step API.
