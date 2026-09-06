---
status: accepted
---

# Let the 5Hz LM rewrite the user's text at most once

Generated songs frequently ignored the prompt's subject matter, came back in a language
the user had not chosen, or used only part of the lyrics the user typed. The cause was
not the model: it was that the backend asked the 5Hz LM to rewrite the request up to
three times before the DiT ever saw it, and the DiT is conditioned on the last rewrite.

For a prompt with no lyrics, `create_sample` replaced the caption
(`llm_generation_inputs.py:141-142`), `format_sample` then paraphrased that output again
because `use_format` was hardcoded on (`:149-178`), and `use_cot_caption` finally
replaced the caption a third time with the LM's CoT version (`inference.py:825-826`).
For a prompt *with* lyrics, the `format_sample` pass regenerated them free-form and
returned its own text in place of the user's — the "lyrics only partially used" report.

Separately, upstream never forwards `vocal_language` into the LM's CoT phase
(`inference.py:670-700` builds `user_metadata` from bpm/keyscale/timesignature/duration
only). With `use_cot_language` on, the LM chose a language itself and generated the audio
semantic codes under that choice, while the DiT lyric encoder was conditioned on the
user's selection — so the two disagreed about what was being sung.

We now derive `use_format`, `use_cot_caption`, and `use_cot_language` in the backend
rather than forwarding them, and send all three off.

## Considered Options

- **Keep the flags on and tune around them** (temperature, steps, prompt wording) —
  rejected. No amount of tuning reaches text that has already been replaced. The
  `"(lyrics in English)"` suffix we had been appending to `sample_query` was exactly this
  kind of workaround: it addressed one path, leaked wording into the caption channel, and
  left the codes/DiT language split untouched.
- **Fix it upstream in the fork** — deferred, not rejected. Two upstream bugs are real and
  worth a PR: the CoT language is read under the wrong key (`metadata.get('vocal_language')`
  where the parser writes `language`) at `inference.py:381` and `:828`, and
  `vocal_language` should reach the CoT phase. But the fork is a rebase surface, carrying
  behavioural patches in it costs us on every upstream merge, and sending
  `use_cot_language=False` achieves the same conditioning without a fork change.
- **Keep `use_format` for the instrumental path**, where there are no user lyrics to
  damage — rejected. It regenerates the lyrics section whatever it is handed, so it can
  return invented lyrics in place of `[Instrumental]` and put vocals on a track that asked
  for none. There is no way to take its caption enrichment without its lyric rewrite.
- **Derive the flags in the backend** (chosen).

## Consequences

The caption the visitor writes is the caption the model is conditioned on, and lyrics
they type reach the model verbatim. `prompt` and the new `topic` field now address
different channels — style versus subject matter — which is a real concept split, not a
form-layout choice: an ACE-Step caption describes instrumentation and mood and has no
route to the vocals, so a narrative request placed there was always going to be lost.

We give up the LM's caption *expansion*, which genuinely helps a terse prompt like
"country". That loss is deliberate and bounded: `use_cot_caption` stays a request field
so the behaviour can be A/B-tested without a redeploy, and doing the expansion under our
own control is the "Two-stage caption" decision in SPEC.md §8.1, implemented alongside
this one: a terse caption is expanded by a dedicated `/format_input` call that is sent
empty lyrics and whose output is kept only as the caption.

These changes were derived by reading the generation path, not by measuring output — no
generations were run against the deployed Modal endpoint, which costs money per call.
Each flag is a payload field, so they can be validated one at a time on a fixed prompt.
