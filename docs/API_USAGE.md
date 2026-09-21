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
Returns realistic, random parameters to prefill the generation form.

### `POST /api/format`
Enhances formatting of user prompts or lyrics via an upstream language model.

### `GET /api/examples/random`
Returns one curated example, drawn at random from the bundled collections, shaped for the
generation form.

```json
{
  "prompt": "a soft Bengali love song for a quiet evening",
  "lyrics": "",
  "vocal_language": "bn",
  "instrumental": false
}
```

### `POST /api/generate-lyrics`
Generates structured song lyrics (`[Verse]`, `[Chorus]`, etc.) using Groq LLM based on user prompt.

**Rate limit:** 10 requests per minute per IP.

**Request Body:**
```json
{
  "prompt": "an upbeat synthwave song about neon nights"
}
```

**Response (200 OK):**
```json
{
  "lyrics": "[Verse 1]\nCruising down the electric avenue..."
}
```

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

### `GET /health`
Returns system health, including the connection status to the upstream ACE-Step API.
