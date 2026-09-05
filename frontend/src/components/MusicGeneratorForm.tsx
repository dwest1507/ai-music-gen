"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { apiFetch, GenerateRequest, GenerateResponse, getRandomExample } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, HelpCircle, Music, Sparkles } from "lucide-react";
import { z } from "zod";

// Personality, kept deliberately subordinate to the phase label. These rotate
// beneath the button; the button itself always states the true phase and elapsed
// time. Nothing here claims the backend is asleep — it is always-on now, and the
// wait is entirely the GPU coming back from scale-to-zero.
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

const generateSchema = z.object({
    prompt: z.string().min(3, "Prompt must be at least 3 characters").max(1000, "Prompt must be less than 1000 characters"),
    genre: z.string().optional(),
    lyrics: z.string().max(5000, "Lyrics must be less than 5000 characters").optional(),
    vocal_language: z.string().optional(),
    instrumental: z.boolean().optional(),
});

function FieldTooltip({ text }: { text: string }) {
    return (
        <span className="relative group inline-flex items-center ml-1.5 align-middle">
            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" strokeWidth={1.5} />
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 w-60 rounded-lg border border-white/[0.10] bg-[#0a0a0c] text-[#ededef] text-xs px-3 py-2 leading-relaxed shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
                {text}
            </span>
        </span>
    );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
    return (
        <label htmlFor={htmlFor} className="field-label">
            {children}
        </label>
    );
}

interface MusicGeneratorFormProps {
    onJobCreated: (jobId: string) => void;
    /** Whether prewarm found the GPU already up. null while still unknown. */
    gpuWarm?: boolean | null;
}

export function MusicGeneratorForm({ onJobCreated, gpuWarm = null }: MusicGeneratorFormProps) {
    const [prompt, setPrompt] = useState("");
    const [genre, setGenre] = useState("");
    const [lyrics, setLyrics] = useState("");
    const [vocalLanguage, setVocalLanguage] = useState("en");
    const [instrumental, setInstrumental] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingExample, setIsLoadingExample] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSubmitTime, setLastSubmitTime] = useState(0);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Either async action locks the form; only generation swaps the button label.
    const isBusy = isLoading || isLoadingExample;

    // Counts upward rather than promising a range. A snapshot rebuild takes
    // roughly twice an ordinary wake, so any figure we promised would sometimes
    // be a figure we broke.
    useEffect(() => {
        if (!isLoading) return;
        const tick = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
        return () => clearInterval(tick);
    }, [isLoading]);

    useEffect(() => {
        if (!isLoading) return;
        const interval = setInterval(() => {
            setLoadingMessageIndex(prev =>
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
            setLyrics(example.lyrics);
            setVocalLanguage(example.vocal_language);
            setInstrumental(example.instrumental);
            // Examples carry no genre — clear any leftover value so the form
            // matches the example exactly.
            setGenre("");
        } catch (err: unknown) {
            setError("Failed to fetch example prompt.");
            console.error(err);
        } finally {
            setIsLoadingExample(false);
        }
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
            const hasUserLyrics = lyrics.replace(/\s/g, "").length > 5;

            const payloadInput = {
                prompt,
                genre: genre || undefined,
                lyrics: (!instrumental && hasUserLyrics) ? lyrics : undefined,
                vocal_language: vocalLanguage,
                instrumental: instrumental || undefined,
            };

            const payload = generateSchema.parse(payloadInput) as GenerateRequest;

            const data = await apiFetch<GenerateResponse>("/api/generate", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            onJobCreated(data.task_id || data.job_id || "");
        } catch (err: unknown) {
            if (err instanceof z.ZodError) {
                setError(err.issues[0].message);
            } else if (err instanceof Error) {
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
                <CardTitle className="flex items-center gap-2.5 text-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05]">
                        <Music className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    </span>
                    Create Music
                </CardTitle>

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
            </CardHeader>

            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="prompt">
                            Prompt <span className="text-destructive ml-0.5">*</span>
                            <FieldTooltip text="Describe the music you want. Include genre, mood, instruments, and energy level for best results. E.g. 'upbeat electronic dance music with heavy bass and synth leads.'" />
                        </Label>
                        <textarea
                            id="prompt"
                            placeholder="E.g., A lo-fi hip hop beat for studying..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isBusy}
                            className="field-input flex min-h-[90px] w-full resize-y px-3 py-2 text-[13px]"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="genre">
                                Genre
                                <FieldTooltip text="Suggested musical genre. You can also include genre directly in your prompt for more specific results." />
                            </Label>
                            <input
                                id="genre"
                                list="genre-options"
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                disabled={isBusy}
                                placeholder="Any"
                                className="field-input flex h-10 w-full px-3 py-2 text-[13px]"
                            />
                            <datalist id="genre-options">
                                <option value="Afrobeat" />
                                <option value="Ambient" />
                                <option value="Blues" />
                                <option value="Cinematic" />
                                <option value="Classical" />
                                <option value="Country" />
                                <option value="Disco" />
                                <option value="Electronic" />
                                <option value="Folk" />
                                <option value="Funk" />
                                <option value="Gospel" />
                                <option value="Hip-Hop" />
                                <option value="Jazz" />
                                <option value="Lo-Fi" />
                                <option value="Metal" />
                                <option value="Pop" />
                                <option value="Punk" />
                                <option value="R&B / Soul" />
                                <option value="Reggae" />
                                <option value="Rock" />
                                <option value="Synthwave" />
                            </datalist>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="vocalLanguage">
                                Language
                                <FieldTooltip text="The vocal language for the generated song. Controls the language of any sung lyrics. Choose the language you want the vocals to be in." />
                            </Label>
                            <Select
                                id="vocalLanguage"
                                value={vocalLanguage}
                                onChange={(e) => setVocalLanguage(e.target.value)}
                                disabled={isBusy}
                                className="w-full"
                            >
                                <option value="bn">Bengali</option>
                                <option value="zh">Chinese</option>
                                <option value="en">English</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="he">Hebrew</option>
                                <option value="hu">Hungarian</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                                <option value="ms">Malay</option>
                                <option value="pl">Polish</option>
                                <option value="pt">Portuguese</option>
                                <option value="es">Spanish</option>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="lyrics">
                            Lyrics
                            <FieldTooltip text="Song lyrics with structure tags like [Verse], [Chorus], [Bridge]. Enter more than 5 non-whitespace characters to use your own lyrics; otherwise ACE-Step's built-in AI auto-generates them. Check 'Instrumental only' to skip vocals entirely." />
                        </Label>
                        <textarea
                            id="lyrics"
                            placeholder="Leave blank for AI auto-generated lyrics..."
                            value={lyrics}
                            onChange={(e) => setLyrics(e.target.value)}
                            disabled={isBusy || instrumental}
                            className="field-input flex min-h-[80px] w-full resize-y px-3 py-2 text-[13px]"
                        />
                    </div>

                    <label className="field-label cursor-pointer gap-2">
                        <input
                            type="checkbox"
                            id="instrumental"
                            checked={instrumental}
                            onChange={(e) => setInstrumental(e.target.checked)}
                            disabled={isBusy}
                            className="h-3.5 w-3.5 accent-[#0ea5e9]"
                        />
                        Instrumental only
                        <FieldTooltip text="Generate music without any vocals. Disables AI lyrics generation and ignores any lyrics input." />
                    </label>

                    <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                        <span className="text-destructive">*</span> Required
                    </p>

                    {error && (
                        <div
                            role="alert"
                            className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.08] p-3 text-[13px] text-destructive"
                        >
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        isLoading={isLoading}
                    >
                        {isLoading
                            ? `${gpuWarm === false ? "Waking GPU" : "Submitting"} · ${elapsedSeconds}s`
                            : "Generate Music"}
                    </Button>

                    {isLoading && (
                        <p className="text-center font-mono text-[10px] leading-relaxed tracking-widest text-muted-foreground">
                            {LOADING_MESSAGES[loadingMessageIndex]}
                        </p>
                    )}
                </form>
            </CardContent>
        </Card>
    );
}
