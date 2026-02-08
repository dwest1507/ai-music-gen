# AI Music Generation API - Usage Guide

## Overview

This API provides AI-powered music generation using the ACE-Step 1.5 model. Submit a text prompt describing the music you want, and the API will generate a high-quality audio file for you.

**Base URL**: `https://your-deployed-api.com` (replace with your actual deployment URL)

---

## Table of Contents

- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Health Check](#health-check)
  - [Submit Generation Job](#submit-generation-job)
  - [Get Job Status](#get-job-status)
  - [Download Audio](#download-audio)
  - [Cancel Job](#cancel-job)
- [Workflow](#workflow)
- [Code Examples](#code-examples)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)

---

## Authentication

The API uses **session-based authentication** via HTTP-only cookies. When you make your first request, the API will automatically create a session and return a `session_id` cookie. This cookie is required for:

- Checking job status
- Downloading generated audio
- Canceling jobs

**Important**: Ensure your HTTP client supports cookies and sends them with subsequent requests.

---

## Rate Limiting

To ensure fair usage, the API implements rate limiting:

- **Generation endpoint**: 5 requests per minute per session
- Exceeding the limit returns a `429 Too Many Requests` error

---

## API Endpoints

### Health Check

Check if the API is running and healthy.

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "healthy",
  "version": "1.0.0"
}
```

**Example**:
```bash
curl https://your-deployed-api.com/health
```

---

### Submit Generation Job

Submit a music generation request. This is an **asynchronous** operation that returns immediately with a job ID.

**Endpoint**: `POST /api/generate`

**Request Body**:
```json
{
  "prompt": "A cheerful acoustic guitar melody with upbeat rhythm",
  "duration": 60,
  "genre": "folk"
}
```

**Parameters**:

| Parameter  | Type   | Required | Description                                      | Constraints           |
|------------|--------|----------|--------------------------------------------------|-----------------------|
| `prompt`   | string | Yes      | Text description of the music to generate       | Max 500 characters    |
| `duration` | int    | No       | Duration of the generated audio in seconds      | 30, 60, or 120 (default: 60) |
| `genre`    | string | No       | Optional genre hint (e.g., "jazz", "rock")      | -                     |

**Response** (202 Accepted):
```json
{
  "job_id": "xYz123AbC456",
  "status": "queued",
  "estimated_wait": 30
}
```

**Example**:
```bash
curl -X POST https://your-deployed-api.com/api/generate \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "prompt": "Relaxing piano music with gentle rain sounds",
    "duration": 60,
    "genre": "ambient"
  }'
```

**Note**: The `-c cookies.txt` flag saves the session cookie for subsequent requests.

---

### Get Job Status

Check the status of a submitted generation job.

**Endpoint**: `GET /api/jobs/{job_id}`

**Path Parameters**:
- `job_id`: The job ID returned from the generation request

**Response**:
```json
{
  "job_id": "xYz123AbC456",
  "status": "finished",
  "created_at": "2026-02-07T22:15:30.123456",
  "enqueued_at": "2026-02-07T22:15:30.234567",
  "audio_url": "/api/audio/xYz123AbC456"
}
```

**Status Values**:
- `queued`: Job is waiting in the queue
- `started`: Job is currently processing
- `finished`: Job completed successfully (audio is ready)
- `failed`: Job failed (see `error` field)

**Example**:
```bash
curl https://your-deployed-api.com/api/jobs/xYz123AbC456 \
  -b cookies.txt
```

**Note**: The `-b cookies.txt` flag sends the session cookie.

---

### Download Audio

Download the generated audio file once the job is complete.

**Endpoint**: `GET /api/audio/{job_id}`

**Path Parameters**:
- `job_id`: The job ID of the completed generation

**Response**:
- **Content-Type**: `audio/wav`
- **File**: WAV audio file

**Example**:
```bash
curl https://your-deployed-api.com/api/audio/xYz123AbC456 \
  -b cookies.txt \
  -o generated_music.wav
```

---

### Cancel Job

Cancel a queued job that hasn't started processing yet.

**Endpoint**: `DELETE /api/jobs/{job_id}`

**Path Parameters**:
- `job_id`: The job ID to cancel

**Response**: `204 No Content` (success)

**Constraints**:
- Can only cancel jobs that are in `queued` status
- Cannot cancel jobs that are `started` or `finished`

**Example**:
```bash
curl -X DELETE https://your-deployed-api.com/api/jobs/xYz123AbC456 \
  -b cookies.txt
```

---

## Workflow

Here's the typical workflow for generating music:

```
1. Submit Generation Job
   ↓
2. Receive job_id
   ↓
3. Poll Job Status (every 5-10 seconds)
   ↓
4. Wait until status = "finished"
   ↓
5. Download Audio using audio_url
```

**Estimated Processing Times**:
- 30 seconds: ~20-40 seconds
- 60 seconds: ~30-60 seconds
- 120 seconds: ~60-120 seconds

*Note: Times vary based on server load and GPU availability.*

---

## Code Examples

### Python (using `requests`)

```python
import requests
import time

BASE_URL = "https://your-deployed-api.com"

# Create a session to handle cookies automatically
session = requests.Session()

# 1. Submit generation job
response = session.post(
    f"{BASE_URL}/api/generate",
    json={
        "prompt": "Epic orchestral music with powerful drums",
        "duration": 60,
        "genre": "cinematic"
    }
)
response.raise_for_status()
job_data = response.json()
job_id = job_data["job_id"]
print(f"Job submitted: {job_id}")

# 2. Poll for completion
while True:
    status_response = session.get(f"{BASE_URL}/api/jobs/{job_id}")
    status_response.raise_for_status()
    status_data = status_response.json()
    
    status = status_data["status"]
    print(f"Status: {status}")
    
    if status == "finished":
        print("Generation complete!")
        break
    elif status == "failed":
        print(f"Generation failed: {status_data.get('error')}")
        exit(1)
    
    time.sleep(5)  # Wait 5 seconds before checking again

# 3. Download the audio
audio_response = session.get(f"{BASE_URL}/api/audio/{job_id}")
audio_response.raise_for_status()

with open("generated_music.wav", "wb") as f:
    f.write(audio_response.content)

print("Audio saved to generated_music.wav")
```

### JavaScript (using `fetch`)

```javascript
const BASE_URL = "https://your-deployed-api.com";

async function generateMusic(prompt, duration = 60, genre = null) {
  // 1. Submit generation job
  const response = await fetch(`${BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Important: Include cookies
    body: JSON.stringify({ prompt, duration, genre }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const { job_id } = await response.json();
  console.log(`Job submitted: ${job_id}`);

  // 2. Poll for completion
  while (true) {
    const statusResponse = await fetch(`${BASE_URL}/api/jobs/${job_id}`, {
      credentials: "include",
    });

    if (!statusResponse.ok) {
      throw new Error(`HTTP error! status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    console.log(`Status: ${statusData.status}`);

    if (statusData.status === "finished") {
      console.log("Generation complete!");
      return job_id;
    } else if (statusData.status === "failed") {
      throw new Error(`Generation failed: ${statusData.error}`);
    }

    // Wait 5 seconds before checking again
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

async function downloadAudio(jobId) {
  const response = await fetch(`${BASE_URL}/api/audio/${jobId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `music_${jobId}.wav`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Usage
(async () => {
  try {
    const jobId = await generateMusic(
      "Upbeat electronic dance music with synth bass",
      60,
      "edm"
    );
    await downloadAudio(jobId);
  } catch (error) {
    console.error("Error:", error);
  }
})();
```

### cURL Complete Example

```bash
#!/bin/bash

BASE_URL="https://your-deployed-api.com"
COOKIE_FILE="cookies.txt"

# 1. Submit generation job
echo "Submitting generation job..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/generate" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  -d '{
    "prompt": "Smooth jazz with saxophone solo",
    "duration": 60,
    "genre": "jazz"
  }')

JOB_ID=$(echo $RESPONSE | jq -r '.job_id')
echo "Job ID: $JOB_ID"

# 2. Poll for completion
while true; do
  STATUS_RESPONSE=$(curl -s "$BASE_URL/api/jobs/$JOB_ID" -b "$COOKIE_FILE")
  STATUS=$(echo $STATUS_RESPONSE | jq -r '.status')
  
  echo "Status: $STATUS"
  
  if [ "$STATUS" = "finished" ]; then
    echo "Generation complete!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Generation failed!"
    exit 1
  fi
  
  sleep 5
done

# 3. Download audio
echo "Downloading audio..."
curl "$BASE_URL/api/audio/$JOB_ID" \
  -b "$COOKIE_FILE" \
  -o "generated_music.wav"

echo "Audio saved to generated_music.wav"
```

---

## Error Handling

### Common Error Responses

| Status Code | Meaning                          | Possible Causes                                    |
|-------------|----------------------------------|----------------------------------------------------|
| `400`       | Bad Request                      | Invalid parameters (e.g., duration not 30/60/120)  |
| `403`       | Forbidden                        | Trying to access another user's job                |
| `404`       | Not Found                        | Job ID doesn't exist or audio file missing         |
| `409`       | Conflict                         | Trying to cancel a started/finished job            |
| `422`       | Unprocessable Entity             | Validation error (e.g., prompt too long)           |
| `429`       | Too Many Requests                | Rate limit exceeded                                |
| `500`       | Internal Server Error            | Server-side error during processing                |

### Error Response Format

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Handling Errors in Code

**Python**:
```python
try:
    response = session.post(f"{BASE_URL}/api/generate", json=data)
    response.raise_for_status()
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 429:
        print("Rate limit exceeded. Please wait before retrying.")
    elif e.response.status_code == 422:
        print(f"Validation error: {e.response.json()['detail']}")
    else:
        print(f"HTTP error: {e}")
```

**JavaScript**:
```javascript
try {
  const response = await fetch(`${BASE_URL}/api/generate`, options);
  
  if (!response.ok) {
    const error = await response.json();
    
    if (response.status === 429) {
      console.error("Rate limit exceeded. Please wait.");
    } else if (response.status === 422) {
      console.error(`Validation error: ${error.detail}`);
    } else {
      console.error(`HTTP error ${response.status}: ${error.detail}`);
    }
    
    throw new Error(error.detail);
  }
  
  // Process successful response
} catch (error) {
  console.error("Request failed:", error);
}
```

---

## Best Practices

### 1. **Respect Rate Limits**
- Implement exponential backoff when hitting rate limits
- Don't submit multiple jobs simultaneously unless necessary

### 2. **Efficient Polling**
- Poll job status every 5-10 seconds (not more frequently)
- Implement a maximum timeout (e.g., 5 minutes) to avoid infinite loops

### 3. **Cookie Management**
- Always use the same session/cookie for related requests
- Store cookies securely (never expose in client-side code for production)

### 4. **Error Handling**
- Always check response status codes
- Implement retry logic for transient errors (500, 503)
- Don't retry on client errors (400, 422)

### 5. **Prompt Engineering**
- Be specific and descriptive in your prompts
- Include musical elements: instruments, mood, tempo, style
- Good: "Upbeat acoustic guitar with fast strumming and cheerful melody"
- Bad: "Music"

### 6. **Resource Cleanup**
- Download and store audio files promptly
- Server may clean up old files after a certain period

### 7. **Security**
- Use HTTPS in production
- Never share job IDs publicly (they're tied to your session)
- Validate and sanitize user input before sending to API

---

## Example Prompts

Here are some example prompts to inspire your music generation:

| Genre          | Example Prompt                                                                 |
|----------------|--------------------------------------------------------------------------------|
| **Ambient**    | "Ethereal ambient soundscape with soft pads and distant chimes"                |
| **Classical**  | "Romantic piano piece in the style of Chopin with expressive dynamics"         |
| **Electronic** | "Energetic techno track with driving bassline and hypnotic synth arpeggios"    |
| **Jazz**       | "Smooth jazz quartet with walking bass, brushed drums, and mellow saxophone"   |
| **Rock**       | "Heavy rock anthem with distorted guitars, powerful drums, and epic chorus"    |
| **Folk**       | "Acoustic folk ballad with fingerpicked guitar and harmonica"                  |
| **Cinematic**  | "Epic orchestral score with soaring strings and triumphant brass fanfare"      |
| **Lo-fi**      | "Chill lo-fi hip hop beat with vinyl crackle and mellow piano chords"          |

---

## Support & Feedback

If you encounter issues or have questions:

1. Check the [error handling](#error-handling) section
2. Review the [best practices](#best-practices)
3. Verify your request format matches the examples
4. Check the API health endpoint to ensure the service is running

---

## Technical Details

### Model Information
- **Model**: ACE-Step 1.5 (Turbo variant)
- **Sample Rate**: 48,000 Hz
- **Format**: WAV (uncompressed)
- **Channels**: Stereo
- **Inference Steps**: 8 (optimized for speed)

### Infrastructure
- **Backend**: FastAPI
- **ML Platform**: Modal (serverless GPU)
- **GPU**: NVIDIA A10G
- **Job Queue**: Redis-backed RQ (Redis Queue)

---

## Changelog

### Version 1.0.0 (2026-02-07)
- Initial release
- Support for text-to-music generation
- Asynchronous job processing
- Session-based authentication
- Rate limiting (5 requests/minute)

---

## License

This API is provided for demonstration and portfolio purposes. Please refer to the main project repository for licensing information.
