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
        let timeoutId: NodeJS.Timeout;
        let isMounted = true;
        const startTime = Date.now();
        const MAX_POLLING_TIME = 10 * 60 * 1000; // 10 minutes timeout

        const fetchJobStatus = async () => {
            if (!isMounted) return;

            const elapsed = Date.now() - startTime;
            if (elapsed > MAX_POLLING_TIME) {
                setError("Generation timed out. Please try again.");
                setIsPolling(false);
                return;
            }

            try {
                const data = await apiFetch<JobResponse>(`/api/jobs/${jobId}`);
                if (!isMounted) return;

                setJob(data);
                if (data.status === "completed" || data.status === "failed") {
                    setIsPolling(false);
                    return;
                }
            } catch (err: unknown) {
                console.error("Polling error:", err);
                if (!isMounted) return;

                if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
                    setError("Job not found");
                    setIsPolling(false);
                    return;
                }
            }

            // Calculate next delay: < 1 min: 2s, < 2 min: 5s, > 2 min: 10s
            let nextDelay = 2000;
            if (elapsed > 120000) {
                nextDelay = 10000;
            } else if (elapsed > 60000) {
                nextDelay = 5000;
            }

            if (isPolling && isMounted) {
                timeoutId = setTimeout(fetchJobStatus, nextDelay);
            }
        };

        if (isPolling) {
            fetchJobStatus();
        }

        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
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
                        &quot;{job.metadata.prompt}&quot;
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
