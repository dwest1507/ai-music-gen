"use client";

import * as React from "react";
import { useState } from "react";
import { apiFetch, GenerateRequest, GenerateResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Music, Settings2, Sparkles } from "lucide-react";
import { z } from "zod";

const generateSchema = z.object({
    prompt: z.string().min(3, "Prompt must be at least 3 characters").max(500, "Prompt must be less than 500 characters"),
    duration: z.coerce.number().int().min(10).max(600),
    genre: z.string().optional(),
    lyrics: z.string().max(5000, "Lyrics must be less than 5000 characters").optional(),
    vocal_language: z.string().optional(),
    audio_format: z.enum(["mp3", "wav", "flac"]).optional(),
    thinking: z.boolean().optional(),
    use_format: z.boolean().optional(),
    bpm: z.coerce.number().int().min(30).max(300).optional().or(z.literal('')),
    key_scale: z.string().optional(),
    time_signature: z.string().optional(),
    inference_steps: z.coerce.number().int().min(1).max(20).optional(),
    batch_size: z.coerce.number().int().min(1).max(4).optional(),
});

interface MusicGeneratorFormProps {
    onJobCreated: (jobId: string) => void;
}

export function MusicGeneratorForm({ onJobCreated }: MusicGeneratorFormProps) {
    const [isAdvanced, setIsAdvanced] = useState(false);
    
    // Simple state
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState("60");
    const [genre, setGenre] = useState("");
    
    // Advanced state
    const [lyrics, setLyrics] = useState("");
    const [vocalLanguage, setVocalLanguage] = useState("en");
    const [thinking, setThinking] = useState(true);
    const [useFormat, setUseFormat] = useState(false);
    const [bpm, setBpm] = useState("");
    const [keyScale, setKeyScale] = useState("");
    const [timeSignature, setTimeSignature] = useState("");
    const [inferenceSteps, setInferenceSteps] = useState("8");
    const [batchSize, setBatchSize] = useState("1");
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSubmitTime, setLastSubmitTime] = useState(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isLoading) return; // Prevent concurrent submissions

        const now = Date.now();
        // 5 second cooldown to prevent rate limit hammering or duplicate accidental spawns
        if (now - lastSubmitTime < 5000) {
            setError("Please wait a few seconds before generating another track.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setLastSubmitTime(now);

        try {
            // Validate
            const payloadInput = {
                prompt,
                duration,
                genre: genre || undefined,
                lyrics: lyrics || undefined,
                vocal_language: vocalLanguage,
                thinking,
                use_format: useFormat,
                bpm: bpm ? parseInt(bpm) : undefined,
                key_scale: keyScale || undefined,
                time_signature: timeSignature || undefined,
                inference_steps: parseInt(inferenceSteps),
                batch_size: parseInt(batchSize),
            };

            const payload = generateSchema.parse(payloadInput) as GenerateRequest;

            const data = await apiFetch<GenerateResponse>("/api/generate", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            onJobCreated(data.task_id || (data as any).job_id); // Support legacy name if needed
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
        <Card className="w-full max-w-2xl mx-auto shadow-lg border-primary/20">
            <CardHeader className="flex flex-row items-start justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <Music className="w-6 h-6 text-primary" />
                        Create Music
                    </CardTitle>
                    <CardDescription>
                        Describe the music you want to generate using AI.
                    </CardDescription>
                </div>
                <Button 
                    type="button"
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setIsAdvanced(!isAdvanced)}
                    className="flex items-center gap-2"
                >
                    <Settings2 className="w-4 h-4" />
                    {isAdvanced ? "Simple Mode" : "Advanced"}
                </Button>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="prompt" className="text-sm font-medium leading-none">
                            Prompt
                        </label>
                        <Input
                            id="prompt"
                            placeholder="E.g., A lo-fi hip hop beat for studying..."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="duration" className="text-sm font-medium leading-none">
                                Duration (seconds)
                            </label>
                            <Input
                                id="duration"
                                type="number"
                                min="10"
                                max="600"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="genre" className="text-sm font-medium leading-none">
                                Genre (Optional)
                            </label>
                            <Select
                                id="genre"
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                disabled={isLoading}
                                className="w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                                <option value="">Any</option>
                                <option value="electronic">Electronic</option>
                                <option value="rock">Rock</option>
                                <option value="jazz">Jazz</option>
                                <option value="classical">Classical</option>
                                <option value="lofi">Lo-Fi</option>
                                <option value="cinematic">Cinematic</option>
                            </Select>
                        </div>
                    </div>

                    {isAdvanced && (
                        <div className="space-y-4 pt-4 border-t border-border mt-4 animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-sm font-semibold flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-purple-500" />
                                Advanced Controls
                            </h3>
                            
                            <div className="space-y-2">
                                <label htmlFor="lyrics" className="text-sm font-medium leading-none">
                                    Lyrics (Optional)
                                </label>
                                <textarea
                                    id="lyrics"
                                    placeholder="Enter your lyrics here..."
                                    value={lyrics}
                                    onChange={(e) => setLyrics(e.target.value)}
                                    disabled={isLoading}
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="vocalLanguage" className="text-sm font-medium leading-none">
                                        Language
                                    </label>
                                    <Select
                                        id="vocalLanguage"
                                        value={vocalLanguage}
                                        onChange={(e) => setVocalLanguage(e.target.value)}
                                        disabled={isLoading}
                                        className="w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        <option value="en">English</option>
                                        <option value="ja">Japanese</option>
                                        <option value="ko">Korean</option>
                                        <option value="zh">Chinese</option>
                                        <option value="fr">French</option>
                                        <option value="es">Spanish</option>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="bpm" className="text-sm font-medium leading-none">
                                        BPM / Tempo
                                    </label>
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
                                    <label htmlFor="keyScale" className="text-sm font-medium leading-none">
                                        Key / Scale
                                    </label>
                                    <Input
                                        id="keyScale"
                                        placeholder="e.g. C Major"
                                        value={keyScale}
                                        onChange={(e) => setKeyScale(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="timeSignature" className="text-sm font-medium leading-none">
                                        Time Sig.
                                    </label>
                                    <Input
                                        id="timeSignature"
                                        placeholder="e.g. 4/4"
                                        value={timeSignature}
                                        onChange={(e) => setTimeSignature(e.target.value)}
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="inferenceSteps" className="text-sm font-medium leading-none">
                                        Inference Steps ({inferenceSteps})
                                    </label>
                                    <Input
                                        id="inferenceSteps"
                                        type="range"
                                        min="1"
                                        max="20"
                                        value={inferenceSteps}
                                        onChange={(e) => setInferenceSteps(e.target.value)}
                                        disabled={isLoading}
                                        className="p-0 border-none shadow-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="batchSize" className="text-sm font-medium leading-none">
                                        Batch Size ({batchSize})
                                    </label>
                                    <Input
                                        id="batchSize"
                                        type="range"
                                        min="1"
                                        max="4"
                                        value={batchSize}
                                        onChange={(e) => setBatchSize(e.target.value)}
                                        disabled={isLoading}
                                        className="p-0 border-none shadow-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-2">
                                <label className="flex items-center gap-2 text-sm font-medium leading-none">
                                    <input 
                                        type="checkbox" 
                                        checked={thinking}
                                        onChange={(e) => setThinking(e.target.checked)}
                                        disabled={isLoading}
                                        className="rounded border-gray-300"
                                    />
                                    Use LM Thinking
                                </label>
                                <label className="flex items-center gap-2 text-sm font-medium leading-none">
                                    <input 
                                        type="checkbox" 
                                        checked={useFormat}
                                        onChange={(e) => setUseFormat(e.target.checked)}
                                        disabled={isLoading}
                                        className="rounded border-gray-300"
                                    />
                                    LM Format Prompt/Lyrics
                                </label>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={isLoading} isLoading={isLoading}>
                        {isLoading ? "Starting Generation..." : "Generate Music"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
