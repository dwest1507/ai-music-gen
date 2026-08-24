"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { apiFetch, GenerateRequest, GenerateResponse, getRandomExample } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, HelpCircle, Music, Settings2, SlidersHorizontal, Sparkles } from "lucide-react";
import { z } from "zod";

const LOADING_MESSAGES = [
    "Starting Generation...",
    "Waiting on the backend to warm up...",
    "The backend goes idle after 5 mins of inactivity...",
    "I did this to save money...",
    "I'm not made of money...",
    "After all, this app is free...",
    "So quit your complaining...",
    "GPUs don't grow on trees, you know...",
    "But yeah, this is taking a while...",
    "Loading... loading... still loading...",
    "The AI is composing a masterpiece, OK?",
    "Please enjoy this moment of zen...",
    "Doo doo doo...",
    "Still here? You must really want this song...",
    "The servers are literally spinning up...",
    "Almost there... probably...",
    "Your patience is admirable, truly...",
    "Any minute now...",
];

const generateSchema = z.object({
    prompt: z.string().min(3, "Prompt must be at least 3 characters").max(1000, "Prompt must be less than 1000 characters"),
    duration: z.coerce.number().int().min(10).max(300),
    genre: z.string().optional(),
    lyrics: z.string().max(5000, "Lyrics must be less than 5000 characters").optional(),
    vocal_language: z.string().optional(),
    audio_format: z.enum(["mp3", "wav", "flac"]).optional(),
    thinking: z.boolean().optional(),
    use_format: z.boolean().optional(),
    instrumental: z.boolean().optional(),
    bpm: z.coerce.number().int().min(30).max(300).optional().or(z.literal('')),
    key_scale: z.string().optional(),
    time_signature: z.string().optional(),
    inference_steps: z.coerce.number().int().min(1).max(20).optional(),
    batch_size: z.coerce.number().int().min(1).max(4).optional(),
    infer_method: z.enum(["ode", "sde"]).optional(),
});

function FieldTooltip({ text }: { text: string }) {
    return (
        <span className="relative group inline-flex items-center ml-1.5 align-middle">
            <HelpCircle className="w-3 h-3 text-muted-foreground cursor-help" strokeWidth={1.5} />
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 w-60 rounded-lg border border-white/[0.08] bg-[#0a0a0c] text-[#ededef] text-xs px-3 py-2 leading-relaxed shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            >
                {text}
            </span>
        </span>
    );
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
    return (
        <label
            htmlFor={htmlFor}
            className="field-label"
        >
            {children}
        </label>
    );
}

interface MusicGeneratorFormProps {
    onJobCreated: (jobId: string) => void;
}

export function MusicGeneratorForm({ onJobCreated }: MusicGeneratorFormProps) {
    const [isAdvanced, setIsAdvanced] = useState(false);

    // Simple state
    const [prompt, setPrompt] = useState("");
    const [durationMins, setDurationMins] = useState("1");
    const [durationSecs, setDurationSecs] = useState("0");
    const [genre, setGenre] = useState("");

    // Advanced state
    const [lyrics, setLyrics] = useState("");
    const [vocalLanguage, setVocalLanguage] = useState("en");
    const [audioFormat, setAudioFormat] = useState<"mp3" | "wav" | "flac">("mp3");
    const [thinking, setThinking] = useState(true);
    const [useFormat, setUseFormat] = useState(false);
    const [instrumental, setInstrumental] = useState(false);
    const [bpm, setBpm] = useState("");
    const [keyScale, setKeyScale] = useState("");
    const [timeSignature, setTimeSignature] = useState("");
    const [inferenceSteps, setInferenceSteps] = useState("8");
    const [batchSize, setBatchSize] = useState("1");
    const [inferMethod, setInferMethod] = useState<"ode" | "sde">("ode");

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSubmitTime, setLastSubmitTime] = useState(0);
    const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

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
        setIsLoading(true);
        setLoadingMessageIndex(0);
        setError(null);
        try {
            const example = await getRandomExample(isAdvanced);
            setPrompt(example.prompt);
            setLyrics(example.lyrics);
            setVocalLanguage(example.vocal_language);
            setDurationMins(Math.floor(example.duration / 60).toString());
            setDurationSecs((example.duration % 60).toString());
            setBpm(example.bpm?.toString() || "");
            setKeyScale(example.key_scale || "");
            setTimeSignature(example.time_signature || "");
            setThinking(example.thinking);
            setIsAdvanced(example.is_advanced);
        } catch (err: unknown) {
            setError("Failed to fetch example prompt.");
            console.error(err);
        } finally {
            setIsLoading(false);
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
        setError(null);
        setLastSubmitTime(now);

        try {
            // Send user lyrics only when they contain substantial content (> 5 non-whitespace chars).
            // Otherwise leave lyrics undefined so the AI auto-generates them.
            // The instrumental flag overrides both and forces [Instrumental] on the backend.
            const hasUserLyrics = lyrics.replace(/\s/g, "").length > 5;

            const payloadInput = {
                prompt,
                duration: (parseInt(durationMins || "0") * 60) + parseInt(durationSecs || "0"),
                genre: genre || undefined,
                lyrics: (!instrumental && hasUserLyrics) ? lyrics : undefined,
                vocal_language: vocalLanguage,
                audio_format: audioFormat,
                thinking,
                use_format: useFormat,
                instrumental: instrumental || undefined,
                bpm: bpm ? parseInt(bpm) : undefined,
                key_scale: keyScale || undefined,
                time_signature: timeSignature || undefined,
                inference_steps: parseInt(inferenceSteps),
                batch_size: parseInt(batchSize),
                infer_method: inferMethod,
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

                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleTryExample}
                        disabled={isLoading}
                        className="flex items-center gap-1.5"
                    >
                        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                        Try an Example
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsAdvanced(!isAdvanced)}
                        className="flex items-center gap-1.5"
                    >
                        <Settings2 className="w-3 h-3" strokeWidth={1.5} />
                        {isAdvanced ? "Simple Mode" : "Advanced"}
                    </Button>
                </div>
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
                            disabled={isLoading}
                            className="field-input flex min-h-[70px] w-full resize-y px-3 py-2 text-[13px]"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                            <Label>
                                Duration <span className="text-destructive ml-0.5">*</span>
                                <FieldTooltip text="Target audio length (10s–5m). 1 minute is a good default. For vocal tracks, match the length to your lyrics." />
                            </Label>
                            <div className="flex items-center gap-1">
                                <Input
                                    id="durationMins"
                                    type="number"
                                    min="0"
                                    max="5"
                                    placeholder="0"
                                    value={durationMins}
                                    onChange={(e) => setDurationMins(e.target.value)}
                                    disabled={isLoading}
                                    className="text-center"
                                    aria-label="Minutes"
                                />
                                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">m</span>
                                <Input
                                    id="durationSecs"
                                    type="number"
                                    min="0"
                                    max="59"
                                    placeholder="0"
                                    value={durationSecs}
                                    onChange={(e) => setDurationSecs(e.target.value)}
                                    disabled={isLoading}
                                    className="text-center"
                                    aria-label="Seconds"
                                />
                                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">s</span>
                            </div>
                        </div>

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
                                disabled={isLoading}
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
                            <Label htmlFor="simpleVocalLanguage">
                                Language
                                <FieldTooltip text="The vocal language for the generated song. Controls the language of any sung lyrics. Choose the language you want the vocals to be in." />
                            </Label>
                            <Select
                                id="simpleVocalLanguage"
                                value={vocalLanguage}
                                onChange={(e) => setVocalLanguage(e.target.value)}
                                disabled={isLoading}
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

                    {isAdvanced && (
                        <div className="mt-6 space-y-4 border-t border-white/[0.08] pt-6 animate-in fade-in slide-in-from-top-2">
                            <h3 className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-primary-bright">
                                <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
                                Advanced Controls
                            </h3>

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
                                    disabled={isLoading || instrumental}
                                    className="field-input flex min-h-[80px] w-full resize-y px-3 py-2 text-[13px]"
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="bpm">
                                        BPM / Tempo
                                        <FieldTooltip text="Beats per minute (30–300). Controls the speed/feel of the music. Leave blank to let the AI choose automatically based on your prompt." />
                                    </Label>
                                    <Input
                                        id="bpm"
                                        type="number"
                                        placeholder="Auto"
                                        min="30"
                                        max="300"
                                        value={bpm}
                                        onChange={(e) => setBpm(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="keyScale">
                                        Key / Scale
                                        <FieldTooltip text="Musical key, e.g. 'C Major' or 'F# minor'. Constrains the harmonic content. Leave blank for AI auto-detection." />
                                    </Label>
                                    <Input
                                        id="keyScale"
                                        placeholder="e.g. C Major"
                                        value={keyScale}
                                        onChange={(e) => setKeyScale(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="timeSignature">
                                        Time Sig.
                                        <FieldTooltip text="Time signature, e.g. '4/4' (common), '3/4' (waltz), '6/8' (compound). Affects the rhythmic feel. Leave blank for auto-detection." />
                                    </Label>
                                    <Input
                                        id="timeSignature"
                                        placeholder="e.g. 4/4"
                                        value={timeSignature}
                                        onChange={(e) => setTimeSignature(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="audioFormat">
                                        Audio Format
                                        <FieldTooltip text="Output audio file format. MP3 is smallest and most compatible. WAV is lossless and uncompressed. FLAC is lossless and compressed." />
                                    </Label>
                                    <Select
                                        id="audioFormat"
                                        value={audioFormat}
                                        onChange={(e) => setAudioFormat(e.target.value as "mp3" | "wav" | "flac")}
                                        disabled={isLoading}
                                        className="w-full"
                                    >
                                        <option value="mp3">MP3</option>
                                        <option value="wav">WAV</option>
                                        <option value="flac">FLAC</option>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="inferMethod">
                                        Diffusion Method
                                        <FieldTooltip text="ODE (Euler) is faster and more deterministic. SDE (stochastic) adds randomness during sampling, which can produce more creative or varied results." />
                                    </Label>
                                    <Select
                                        id="inferMethod"
                                        value={inferMethod}
                                        onChange={(e) => setInferMethod(e.target.value as "ode" | "sde")}
                                        disabled={isLoading}
                                        className="w-full"
                                    >
                                        <option value="ode">ODE (Fast)</option>
                                        <option value="sde">SDE (Creative)</option>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="inferenceSteps">
                                        Inference Steps ({inferenceSteps})
                                        <FieldTooltip text="Number of denoising steps (1–20). Higher = better quality but slower generation. 8 is the recommended sweet spot for the turbo model." />
                                    </Label>
                                    <Input
                                        id="inferenceSteps"
                                        type="range"
                                        min="1"
                                        max="20"
                                        value={inferenceSteps}
                                        onChange={(e) => setInferenceSteps(e.target.value)}
                                        disabled={isLoading}
                                        className="h-8"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="batchSize">
                                        Batch Size ({batchSize})
                                        <FieldTooltip text="Number of music variations to generate in parallel (1–4). More variations take more time and GPU memory, but give you more to choose from." />
                                    </Label>
                                    <Input
                                        id="batchSize"
                                        type="range"
                                        min="1"
                                        max="4"
                                        value={batchSize}
                                        onChange={(e) => setBatchSize(e.target.value)}
                                        disabled={isLoading}
                                        className="h-8"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-5 pt-2">
                                <label className="field-label cursor-pointer gap-2">
                                    <input
                                        type="checkbox"
                                        checked={thinking}
                                        onChange={(e) => setThinking(e.target.checked)}
                                        disabled={isLoading}
                                        className="h-3.5 w-3.5 accent-[#0ea5e9]"
                                    />
                                    Use LM Thinking
                                    <FieldTooltip text="Enables AI chain-of-thought reasoning to automatically detect and refine metadata like BPM, key, and duration. Recommended for best results." />
                                </label>
                                <label className="field-label cursor-pointer gap-2">
                                    <input
                                        type="checkbox"
                                        checked={useFormat}
                                        onChange={(e) => setUseFormat(e.target.checked)}
                                        disabled={isLoading}
                                        className="h-3.5 w-3.5 accent-[#0ea5e9]"
                                    />
                                    LM Format Prompt/Lyrics
                                    <FieldTooltip text="Uses the AI to enhance and structure your prompt and lyrics before generation. Useful when your input is short or informal." />
                                </label>
                                <label className="field-label cursor-pointer gap-2">
                                    <input
                                        type="checkbox"
                                        id="instrumental"
                                        checked={instrumental}
                                        onChange={(e) => setInstrumental(e.target.checked)}
                                        disabled={isLoading}
                                        className="h-3.5 w-3.5 accent-[#0ea5e9]"
                                    />
                                    Instrumental only
                                    <FieldTooltip text="Generate music without any vocals. Disables AI lyrics generation and ignores any lyrics input." />
                                </label>
                            </div>
                        </div>
                    )}

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
                        disabled={isLoading}
                        isLoading={isLoading}
                    >
                        {isLoading ? LOADING_MESSAGES[loadingMessageIndex] : "Generate Music"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
