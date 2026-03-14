# Reference: API Endpoints

The AI Music Generation backend acts as a stateless HTTP proxy over the ACE-Step Modal API.

## Core Generation Endpoints

### `POST /api/generate`
Submits a new music generation task.

**Request Body:**
```json
{
  "prompt": "Epic orchestral score",
  "lyrics": "Optional lyrics here",
  "duration": 60,
  "genre": "Soundtrack",
  "vocal_language": "en",
  "audio_format": "mp3",
  "thinking": true,
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

### `GET /health`
Returns system health, including the connection status to the upstream ACE-Step API.
