# Reference: API Endpoints

The AI Music Generation backend acts as a stateless HTTP proxy over the ACE-Step Modal API.

## Core Generation Endpoints

### `POST /api/generate`
Submits a new music generation task.

**Lyrics resolution order (backend):**
1. `instrumental: true` → forces `[Instrumental]` (no vocals)
2. `lyrics` provided (> 5 non-whitespace chars) → uses the supplied lyrics as-is
3. No lyrics + not instrumental → the request is sent with `sample_mode: true` and a
   `sample_query` built from the prompt and vocal language, delegating lyrics writing to
   ACE-Step's built-in 5Hz language model.

**Request Body:**

`prompt` is the only required field. The web UI sends just `prompt`, `genre`, `lyrics`,
`vocal_language`, and `instrumental`; everything else falls back to quality-tuned defaults.
Omitting `duration` lets the model pick a length that fits the song.

```json
{
  "prompt": "Epic orchestral score",
  "lyrics": "Optional lyrics here",
  "instrumental": false,
  "genre": "Soundtrack",
  "vocal_language": "en",
  "duration": 60,
  "audio_format": "mp3",
  "thinking": true,
  "use_format": true,
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

### `GET /health`
Returns system health, including the connection status to the upstream ACE-Step API.
