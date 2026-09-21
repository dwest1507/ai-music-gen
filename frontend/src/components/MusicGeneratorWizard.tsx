"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { apiFetch, GenerateRequest, GenerateResponse, getRandomExample, generateLyrics, formatLyrics, enhancePrompt, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Mic, Music, Radio, RefreshCw, Sparkles } from "lucide-react";
import { z } from "zod";

const LOADING_MESSAGES = [
    "The GPU scales to zero between visits. This is that.",
    "Cheaper than leaving an A100 idling. Slower, too.",
    "Loading two billion parameters back into memory...",
    "I'm not made of money...",
    "GPUs don't grow on trees, you know...",
    "After all, this app is free...",
    "Restoring a memory snapshot. Genuinely.",
    "A great song takes time. Even for robots.",
    "Beethoven took years. This'll take a minute.",
    "Any second now...",
];

/** Enhancements allowed per song; the backend refuses a fourth. */
const MAX_ENHANCE_ATTEMPTS = 3;

/** Lyric regenerations allowed per unique prompt. */
const MAX_LYRICS_REGEN_ATTEMPTS = 3;

const promptSchema = z.string().min(3, "Prompt must be at least 3 characters").max(1000, "Prompt must be less than 1000 characters");

export type SongType = "lyrics" | "instrumental";

export interface MusicGeneratorWizardProps {
    onJobCreated: (jobId: string) => void;
    /** Whether prewarm found the GPU already up. null while still unknown. */
    gpuWarm?: boolean | null;
}

export function MusicGeneratorWizard({ onJobCreated, gpuWarm = null }: MusicGeneratorWizardProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [prompt, setPrompt] = useState("");
    const [songType, setSongType] = useState<SongType>("instrumental");
    const [preCachedLyrics, setPreCachedLyrics] = useState("");
    const [lyrics, setLyrics] = useState("");
    const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
    const [lyricsError, setLyricsError] = useState<string | null>(null);
    const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string | null>(null);
    const [examplePrompt, setExamplePrompt] = useState<string | null>(null);
    const [isExampleModified, setIsExampleModified] = useState(false);
    const [pristineLyrics, setPristineLyrics] = useState("");
    const [isFormattingLyrics, setIsFormattingLyrics] = useState(false);
    const [lyricsRegenAttemptsLeft, setLyricsRegenAttemptsLeft] = useState(MAX_LYRICS_REGEN_ATTEMPTS);
    const [isConfirmingRegenerate, setIsConfirmingRegenerate] = useState(false);
    const [enhanceAttemptsLeft, setEnhanceAttemptsLeft] = useState(MAX_ENHANCE_ATTEMPTS);
    const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    // Set when the backend reports Groq is not configured; enhancement is a nicety, so
    // the button goes quiet rather than blocking the rest of the wizard.
    const [enhanceUnavailable, setEnhanceUnavailable] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingExample, setIsLoadingExample] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSubmitTime, setLastSubmitTime] = useState(0);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const isBusy = isLoading || isLoadingExample || isLoadingLyrics || isFormattingLyrics || isEnhancing;

    useEffect(() => {
        if (!isLoading) return;
        const tick = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
        return () => clearInterval(tick);
    }, [isLoading]);

    useEffect(() => {
        if (!isLoading) return;
        const interval = setInterval(() => {
            setLoadingMessageIndex((prev) =>
                prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev
            );
        }, 10000);
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleTryExample = async () => {
        setIsLoadingExample(true);
        setError(null);
        try {
            const example = await getRandomExample();
            setPrompt(example.prompt);
            setExamplePrompt(example.prompt);
            setIsExampleModified(false);
            setPreCachedLyrics(example.lyrics || "");
            setLyrics(example.lyrics || "");
            setPristineLyrics(example.lyrics || "");
            setLastGeneratedPrompt(example.prompt);
            setLyricsRegenAttemptsLeft(MAX_LYRICS_REGEN_ATTEMPTS);
        } catch (err: unknown) {
            setError("Failed to fetch example prompt.");
            console.error(err);
        } finally {
            setIsLoadingExample(false);
        }
    };

    const handlePromptChange = (val: string) => {
        setPrompt(val);
        if (examplePrompt && val.trim() !== examplePrompt.trim()) {
            setIsExampleModified(true);
            setPreCachedLyrics("");
        }
        if (lastGeneratedPrompt && val.trim() !== lastGeneratedPrompt.trim()) {
            setLastGeneratedPrompt(null);
            setLyricsRegenAttemptsLeft(MAX_LYRICS_REGEN_ATTEMPTS);
        }
    };

    const handleEnhance = async () => {
        setError(null);
        const result = promptSchema.safeParse(prompt.trim());
        if (!result.success) {
            setError(result.error.issues[0].message);
            return;
        }
        const base = originalPrompt ?? prompt.trim();
        const attempt = MAX_ENHANCE_ATTEMPTS - enhanceAttemptsLeft + 1;
        setIsEnhancing(true);
        try {
            const data = await enhancePrompt(prompt.trim(), attempt, originalPrompt ?? undefined);
            setOriginalPrompt(base);
            setEnhanceAttemptsLeft((left) => left - 1);
            handlePromptChange(data.prompt);
        } catch (err: unknown) {
            if (err instanceof ApiError && err.status === 503) {
                setEnhanceUnavailable(true);
            } else {
                console.error(err);
                setError("Prompt enhancement failed. Please try again.");
            }
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleRevertEnhancement = () => {
        if (originalPrompt === null) return;
        handlePromptChange(originalPrompt);
        setOriginalPrompt(null);
    };

    const handleStep1Next = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        const result = promptSchema.safeParse(prompt.trim());
        if (!result.success) {
            setError(result.error.issues[0].message);
            return;
        }
        setStep(2);
    };

    const fetchAiLyrics = async (promptText: string, previousLyrics?: string): Promise<boolean> => {
        setIsLoadingLyrics(true);
        setLyricsError(null);
        try {
            const data = await generateLyrics(promptText, previousLyrics);
            setLyrics(data.lyrics);
            setPristineLyrics(data.lyrics);
            setLastGeneratedPrompt(promptText);
            return true;
        } catch (err: unknown) {
            console.error(err);
            setLyricsError(
                err instanceof Error
                    ? err.message
                    : "AI lyric service is unavailable. You can enter your own lyrics below or leave blank for instrumental."
            );
            return false;
        } finally {
            setIsLoadingLyrics(false);
        }
    };

    const regenerateLyrics = async () => {
        setIsConfirmingRegenerate(false);
        const succeeded = await fetchAiLyrics(prompt.trim(), pristineLyrics || undefined);
        if (succeeded) {
            setLyricsRegenAttemptsLeft((left) => left - 1);
            // The example's premade lyrics must not be restored over the new take.
            setPreCachedLyrics("");
        }
    };

    const handleRegenerateLyrics = () => {
        if (lyrics.trim() !== pristineLyrics.trim()) {
            setIsConfirmingRegenerate(true);
            return;
        }
        void regenerateLyrics();
    };

    const handleSelectSongType = async (type: SongType) => {
        setSongType(type);
        setStep(3);
        if (type === "lyrics") {
            const trimmedPrompt = prompt.trim();
            if (preCachedLyrics && !isExampleModified) {
                setLyrics(preCachedLyrics);
                setPristineLyrics(preCachedLyrics);
                setLastGeneratedPrompt(trimmedPrompt);
                return;
            }
            if (lyrics && lastGeneratedPrompt === trimmedPrompt) {
                return;
            }
            await fetchAiLyrics(trimmedPrompt);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading || isFormattingLyrics) return;

        const now = Date.now();
        if (now - lastSubmitTime < 5000) {
            setError("Please wait a few seconds before generating another track.");
            return;
        }

        let lyricsToSubmit = lyrics.trim();

        // Auto-formatting for edited lyrics with raw fallback (Issue #87)
        if (songType === "lyrics" && lyricsToSubmit && lyricsToSubmit !== pristineLyrics.trim()) {
            setIsFormattingLyrics(true);
            try {
                const formatted = await formatLyrics(lyricsToSubmit);
                if (formatted && formatted.lyrics) {
                    lyricsToSubmit = formatted.lyrics.trim();
                    setLyrics(formatted.lyrics);
                    setPristineLyrics(formatted.lyrics);
                }
            } catch (err: unknown) {
                console.warn("Auto-formatting failed, falling back to raw edited lyrics:", err);
            } finally {
                setIsFormattingLyrics(false);
            }
        }

        setIsLoading(true);
        setLoadingMessageIndex(0);
        setElapsedSeconds(0);
        setError(null);
        setLastSubmitTime(Date.now());

        try {
            const trimmedPrompt = prompt.trim();
            const isInstrumentalSubmission =
                songType === "instrumental" || (songType === "lyrics" && !lyricsToSubmit);

            const payload: GenerateRequest = {
                prompt: trimmedPrompt,
                vocal_language: "en",
                lyrics: isInstrumentalSubmission ? "[Instrumental]" : lyricsToSubmit,
                instrumental: isInstrumentalSubmission ? true : undefined,
            };

            const data = await apiFetch<GenerateResponse>("/api/generate", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            onJobCreated(data.task_id || data.job_id || "");
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message || "Failed to start generation job");
            } else {
                setError("An unexpected error occurred");
            }
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader className="gap-4 border-b border-white/[0.08] p-5 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05]">
                        <Music className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    </span>
                    <div>
                        <CardTitle className="text-sm font-medium">Create Music</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                Step {step} of 3
                            </span>
                            <span className="text-[10px] text-white/[0.2]">•</span>
                            <span className="font-mono text-[10px] tracking-widest text-primary">
                                {step === 1 ? "Prompt" : step === 2 ? "Type Choice" : "Confirmation"}
                            </span>
                        </div>
                    </div>
                </div>

                {step === 1 && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTryExample}
                        disabled={isBusy}
                        className="flex items-center gap-1.5"
                    >
                        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                        {isLoadingExample ? "Loading..." : "Try an Example"}
                    </Button>
                )}
            </CardHeader>

            <CardContent className="pt-6">
                {step === 1 && (
                    <form onSubmit={handleStep1Next} className="space-y-5">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label htmlFor="prompt-input" className="field-label">
                                    Describe your song <span className="text-destructive ml-0.5">*</span>
                                </label>
                                <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                    {prompt.length}/1000
                                </span>
                            </div>
                            <textarea
                                id="prompt-input"
                                aria-label="Describe your song prompt"
                                placeholder="Describe the sound, style, mood, instrumentation, and narrative theme. E.g., 'An energetic indie-rock song about chasing dreams in a neon city, driven by distorted guitars and punchy drums'..."
                                value={prompt}
                                onChange={(e) => handlePromptChange(e.target.value)}
                                disabled={isBusy}
                                className="field-input flex min-h-[120px] w-full resize-y px-3 py-2.5 text-[13px] leading-relaxed"
                            />
                            <div className="flex items-center justify-between gap-3">
                                <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                    Musical vibe and story in one unified description. Defaults to English.
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                        {enhanceAttemptsLeft} left
                                    </span>
                                    {originalPrompt !== null && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleRevertEnhancement}
                                            disabled={isBusy}
                                        >
                                            Revert to Original
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleEnhance}
                                        disabled={isBusy || enhanceAttemptsLeft === 0 || enhanceUnavailable}
                                        title={
                                            enhanceUnavailable
                                                ? "Prompt enhancement is unavailable right now. You can still continue with your own prompt."
                                                : undefined
                                        }
                                        className="flex items-center gap-1.5"
                                    >
                                        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                                        {isEnhancing ? "Enhancing..." : "Enhance Prompt"}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.08] p-3 text-[13px] text-destructive"
                            >
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button
                                type="submit"
                                size="lg"
                                disabled={isBusy}
                                className="flex items-center gap-2 px-6"
                            >
                                Continue
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </form>
                )}

                {step === 2 && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-base font-medium text-foreground">Choose Song Type</h3>
                            <p className="font-mono text-[11px] tracking-widest text-muted-foreground mt-1">
                                Select whether you want vocal lyrics or a pure instrumental track.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => handleSelectSongType("lyrics")}
                                className={`group flex flex-col items-start p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                                    songType === "lyrics"
                                        ? "border-primary bg-primary/[0.06] shadow-[0_0_24px_rgba(14,165,233,0.12)]"
                                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.04]"
                                }`}
                            >
                                <div className="flex items-center justify-between w-full mb-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] group-hover:border-primary/40 transition-colors">
                                        <Mic className="h-4.5 w-4.5 text-primary" strokeWidth={1.5} />
                                    </span>
                                    {songType === "lyrics" && (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                            <Check className="h-3 w-3" strokeWidth={2.5} />
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-foreground">Song with Lyrics</span>
                                <span className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    Features vocal singing and lyrics based on your theme.
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleSelectSongType("instrumental")}
                                className={`group flex flex-col items-start p-5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                                    songType === "instrumental"
                                        ? "border-primary bg-primary/[0.06] shadow-[0_0_24px_rgba(14,165,233,0.12)]"
                                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.2] hover:bg-white/[0.04]"
                                }`}
                            >
                                <div className="flex items-center justify-between w-full mb-3">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] group-hover:border-primary/40 transition-colors">
                                        <Radio className="h-4.5 w-4.5 text-primary" strokeWidth={1.5} />
                                    </span>
                                    {songType === "instrumental" && (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                            <Check className="h-3 w-3" strokeWidth={2.5} />
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-foreground">Instrumental</span>
                                <span className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    Pure music composition without any singing or vocals.
                                </span>
                            </button>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep(1)}
                                className="flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back
                            </Button>
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <h3 className="text-base font-medium text-foreground">Review & Confirmation</h3>
                            <p className="font-mono text-[11px] tracking-widest text-muted-foreground mt-1">
                                Confirm your configuration before starting generation.
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
                            <div>
                                <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                                    Prompt
                                </span>
                                <p className="text-[13px] text-foreground mt-1 leading-relaxed italic bg-white/[0.02] p-3 rounded-lg border border-white/[0.04]">
                                    {"\""}{prompt}{"\""}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div>
                                    <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                                        Track Type
                                    </span>
                                    <p className="text-sm font-medium text-foreground mt-0.5">
                                        {songType === "instrumental" ? "Instrumental (No Vocals)" : "Song with Lyrics"}
                                    </p>
                                </div>
                                <div>
                                    <span className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                                        Language
                                    </span>
                                    <p className="text-sm font-medium text-foreground mt-0.5">
                                        English (en)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {songType === "lyrics" && (
                            <div className="space-y-4">
                                {isLoadingLyrics ? (
                                    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                                        <div className="flex items-center gap-2 text-primary">
                                            <Sparkles className="h-4 w-4 animate-spin text-primary" />
                                            <span className="text-xs font-medium tracking-wide">
                                                Writing song lyrics with AI...
                                            </span>
                                        </div>
                                        <div className="space-y-2 animate-pulse pt-2">
                                            <div className="h-3.5 bg-white/[0.08] rounded-md w-3/4"></div>
                                            <div className="h-3.5 bg-white/[0.08] rounded-md w-1/2"></div>
                                            <div className="h-3.5 bg-white/[0.08] rounded-md w-5/6"></div>
                                            <div className="h-3.5 bg-white/[0.08] rounded-md w-2/3"></div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {isConfirmingRegenerate && (
                                            <div
                                                role="alert"
                                                className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/[0.08] p-3 text-[13px] text-warning sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <span>
                                                    Regenerating will discard your edits to these lyrics.
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIsConfirmingRegenerate(false)}
                                                    >
                                                        Keep my edits
                                                    </Button>
                                                    <Button type="button" size="sm" onClick={regenerateLyrics}>
                                                        Discard edits & regenerate
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {lyricsError && (
                                            <div
                                                role="alert"
                                                className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/[0.08] p-3 text-[13px] text-warning"
                                            >
                                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                                <span>{lyricsError}</span>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label htmlFor="lyrics-editor" className="field-label">
                                                    Review & Edit Lyrics
                                                </label>
                                                <div className="flex items-center gap-3">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleRegenerateLyrics}
                                                        disabled={isBusy || lyricsRegenAttemptsLeft <= 0}
                                                        className="flex items-center gap-1.5"
                                                    >
                                                        <RefreshCw className="w-3 h-3" strokeWidth={1.5} />
                                                        Regenerate Lyrics
                                                        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                                            {lyricsRegenAttemptsLeft} left
                                                        </span>
                                                    </Button>
                                                    <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                                        {lyrics.length}/5000
                                                    </span>
                                                </div>
                                            </div>
                                            <textarea
                                                id="lyrics-editor"
                                                aria-label="Song lyrics"
                                                value={lyrics}
                                                onChange={(e) => setLyrics(e.target.value)}
                                                disabled={isBusy}
                                                placeholder="Enter or edit song lyrics... (Leave empty to generate as instrumental)"
                                                className="field-input flex min-h-[180px] font-mono w-full resize-y px-3 py-2.5 text-[12px] leading-relaxed"
                                            />
                                            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                                Structured stanzas with [Verse], [Chorus] tags. Clearing this box generates an instrumental.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}


                        {error && (
                            <div
                                role="alert"
                                className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.08] p-3 text-[13px] text-destructive"
                            >
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setStep(2)}
                                disabled={isBusy}
                                className="flex items-center gap-1.5"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                Back
                            </Button>

                            <Button
                                type="submit"
                                size="lg"
                                disabled={isBusy}
                                className="px-6"
                            >
                                {isFormattingLyrics
                                    ? "Formatting lyrics..."
                                    : isLoading
                                    ? `${gpuWarm === false ? "Waking GPU" : "Submitting"} · ${elapsedSeconds}s`
                                    : "Generate Song"}
                            </Button>
                        </div>

                        {isLoading && (
                            <p className="text-center font-mono text-[10px] leading-relaxed tracking-widest text-muted-foreground">
                                {LOADING_MESSAGES[loadingMessageIndex]}
                            </p>
                        )}
                    </form>
                )}
            </CardContent>
        </Card>
    );
}
