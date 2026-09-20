"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { apiFetch, GenerateRequest, GenerateResponse, getRandomExample } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, ArrowRight, Check, Mic, Music, Radio, Sparkles } from "lucide-react";
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

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingExample, setIsLoadingExample] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSubmitTime, setLastSubmitTime] = useState(0);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    const isBusy = isLoading || isLoadingExample;

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
            setPreCachedLyrics(example.lyrics || "");
        } catch (err: unknown) {
            setError("Failed to fetch example prompt.");
            console.error(err);
        } finally {
            setIsLoadingExample(false);
        }
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

    const handleSelectSongType = (type: SongType) => {
        setSongType(type);
        setStep(3);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        const now = Date.now();
        if (now - lastSubmitTime < 5000) {
            setError("Please wait a few seconds before generating another track.");
            return;
        }

        setIsLoading(true);
        setLoadingMessageIndex(0);
        setElapsedSeconds(0);
        setError(null);
        setLastSubmitTime(now);

        try {
            const payload: GenerateRequest = {
                prompt: prompt.trim(),
                vocal_language: "en",
                lyrics: songType === "instrumental" ? "[Instrumental]" : (preCachedLyrics || undefined),
                instrumental: songType === "instrumental" ? true : undefined,
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
                                onChange={(e) => setPrompt(e.target.value)}
                                disabled={isBusy}
                                className="field-input flex min-h-[120px] w-full resize-y px-3 py-2.5 text-[13px] leading-relaxed"
                            />
                            <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                                Musical vibe and story in one unified description. Defaults to English.
                            </p>
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
                                {isLoading
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
