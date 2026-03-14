"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { apiFetch, JobResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock, Activity, Hash, FileAudio, Music } from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Badge } from "@/components/ui/badge";

interface JobStatusProps {
    jobId: string;
}

export function JobStatus({ jobId }: JobStatusProps) {
    const [job, setJob] = useState<JobResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(true);

    // Poll for job updates
    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const fetchJobStatus = async () => {
            try {
                const data = await apiFetch<JobResponse>(`/api/jobs/${jobId}`);
                setJob(data);

                if (data.status === "completed" || data.status === "failed") {
                    setIsPolling(false);
                    clearInterval(intervalId);
                }
            } catch (err: unknown) {
                console.error("Polling error:", err);
                if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
                    setError("Job not found");
                    setIsPolling(false);
                    clearInterval(intervalId);
                }
            }
        };

        if (isPolling) {
            fetchJobStatus(); // Initial fetch
            intervalId = setInterval(fetchJobStatus, 2000); // Poll every 2s
        }

        return () => clearInterval(intervalId);
    }, [jobId, isPolling]);

    if (error) {
        return (
            <Card className="w-full max-w-2xl mx-auto border-destructive/50 bg-destructive/5">
                <CardContent className="pt-6 flex items-center gap-4 text-destructive">
                    <AlertCircle className="w-8 h-8" />
                    <p>{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (!job) {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardContent className="pt-6 flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">Initializing job...</span>
                </CardContent>
            </Card>
        );
    }

    // Prepare audio URLs (compatibility with both single and multiple responses)
    const audioUrls = job.audio_urls || (job.audio_url ? [job.audio_url] : []);

    return (
        <Card className="w-full max-w-2xl mx-auto mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-lg border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    {job.status === "queued" && <Loader2 className="w-5 h-5 animate-spin text-yellow-500" />}
                    {job.status === "processing" && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                    {job.status === "completed" && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {job.status === "failed" && <XCircle className="w-5 h-5 text-red-500" />}

                    <span className="capitalize">
                        {job.status === "queued" && "Waiting in Queue..."}
                        {job.status === "processing" && "Generating Music..."}
                        {job.status === "completed" && "Generation Complete!"}
                        {job.status === "failed" && "Generation Failed"}
                    </span>
                </CardTitle>
                
                {job.metadata && (job.metadata.prompt || job.metadata.genre) && (
                    <CardDescription className="italic line-clamp-2">
                        "{job.metadata.prompt}"
                    </CardDescription>
                )}
            </CardHeader>

            <CardContent className="space-y-6">
                {/* Metadata Badges */}
                {job.metadata && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-border mt-2">
                        {job.metadata.duration && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {job.metadata.duration}s
                            </Badge>
                        )}
                        {job.metadata.bpm && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Activity className="w-3 h-3" /> {job.metadata.bpm} BPM
                            </Badge>
                        )}
                        {job.metadata.key_scale && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Music className="w-3 h-3" /> {job.metadata.key_scale}
                            </Badge>
                        )}
                        {job.metadata.time_signature && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Hash className="w-3 h-3" /> {job.metadata.time_signature}
                            </Badge>
                        )}
                    </div>
                )}

                {job.status === "failed" && (
                    <div className="text-destructive bg-destructive/10 p-3 rounded-md flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                        <span>{job.error || "An unknown error occurred."}</span>
                    </div>
                )}

                {job.status === "completed" && audioUrls.length > 0 && (
                    <div className="space-y-6 pt-4">
                        {audioUrls.map((url, index) => (
                            <div key={index} className="space-y-2">
                                {audioUrls.length > 1 && (
                                    <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                                        <FileAudio className="w-4 h-4" />
                                        Variation {index + 1}
                                    </h4>
                                )}
                                <AudioPlayer audioUrl={url} />
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
