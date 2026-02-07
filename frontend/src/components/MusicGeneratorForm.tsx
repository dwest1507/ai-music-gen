"use client";

import * as React from "react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Music } from "lucide-react";
import { z } from "zod";

const generateSchema = z.object({
    prompt: z.string().min(3, "Prompt must be at least 3 characters").max(500, "Prompt must be less than 500 characters"),
    duration: z.coerce.number().int().min(10).max(180), // Adjusted constraints to be safe
    genre: z.string().optional(),
});

interface GenerateResponse {
    job_id: string;
    status: string;
    estimated_wait: number;
}

interface MusicGeneratorFormProps {
    onJobCreated: (jobId: string) => void;
}

export function MusicGeneratorForm({ onJobCreated }: MusicGeneratorFormProps) {
    const [prompt, setPrompt] = useState("");
    const [duration, setDuration] = useState("60");
    const [genre, setGenre] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Validate
            const payload = generateSchema.parse({
                prompt,
                duration,
                genre: genre || undefined,
            });

            const data = await apiFetch<GenerateResponse>("/api/generate", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            onJobCreated(data.job_id);
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
        <Card className="w-full max-w-lg mx-auto shadow-lg border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Music className="w-6 h-6 text-primary" />
                    Create Music
                </CardTitle>
                <CardDescription>
                    Describe the music you want to generate using AI.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="prompt" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
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
                                Duration
                            </label>
                            <Select
                                id="duration"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                disabled={isLoading}
                            >
                                <option value="30">30 Seconds</option>
                                <option value="60">60 Seconds</option>
                                <option value="120">120 Seconds</option>
                            </Select>
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

                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full" isLoading={isLoading}>
                        Generate Music
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
