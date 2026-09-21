# AI Music Gen

A web application that turns a text prompt into a generated song. The backend is a
stateless proxy; all inference happens on GPU infrastructure operated by a separate
deployment.

## Language

### Generation

**Task**:
One request to turn a prompt into audio, identified by a `task_id` issued by the
inference service. The unit the user waits on.
_Avoid_: Job, generation, render

**Prompt**:
The user's single free-text description of the song — including musical style, mood,
instrumentation, and subject matter. Groq decomposes this into structured lyrics and
musical styling for ACE-Step.
_Avoid_: Caption, description, query, style input

**Enhancement**:
A Groq rewrite of the Prompt that adds tempo, instrumentation, and mood detail while
keeping its subject. Limited to three per song; later ones are variations of the
visitor's original wording, never an expansion of the previous enhancement.
_Avoid_: Prompt expansion, rewrite, boost

**Topic**:
Retired as a standalone user input. The song's subject matter is now written directly into
the Prompt, where the Groq songwriter extracts it to compose the lyrics.
_Avoid_: Subject, theme, sample query, about

**Example**:
A curated, pre-written prompt shipped with the application that a user can load into
the form with one click.
_Avoid_: Sample, random sample, demo

### Latency

The total wait a user experiences is the sum of three independent delays. They have
different causes, different costs to remove, and must not be conflated.

**Railway wake**:
The delay while the backend's container starts because it had scaled to zero.
_Avoid_: Backend cold start, server warmup

**Modal wake**:
The delay while the GPU container starts and restores its model snapshot because it
had scaled to zero.
_Avoid_: GPU cold start, model loading

**Snapshot rebuild**:
A Modal wake where the saved snapshot was discarded, so the models are loaded from
scratch and the snapshot re-created. Roughly twice the delay of an ordinary wake, and
it happens without warning.
_Avoid_: Snapshot miss, cache miss, snapshot failure

**Inference**:
The time the GPU spends actually generating audio, once it is warm.
_Avoid_: Generation time, processing

**Prewarm**:
Deliberately triggering a wake before the user asks for a song, so the wake overlaps
time the user was going to spend anyway.
_Avoid_: Warmup, keep-alive, ping

**Warm window**:
The period a container stays alive after its last request before scaling to zero.
_Avoid_: Idle timeout, scaledown, TTL
