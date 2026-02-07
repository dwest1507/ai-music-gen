"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";

interface JobStatusProps {
    jobId: string;
}

interface JobResponse {
    job_id: string;
    status: "queued" | "processing" | "completed" | "failed";
    progress?: number;
    audio_url?: string;
    error?: string;
    created_at: string;
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
                // Don't stop polling on transient network errors, but show something maybe?
                // For distinct 404s or 500s we might want to stop.
                // For now, let's keep polling unless it's a 404.
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
            <Card className="w-full max-w-lg mx-auto border-destructive/50 bg-destructive/5">
                <CardContent className="pt-6 flex items-center gap-4 text-destructive">
                    <AlertCircle className="w-8 h-8" />
                    <p>{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (!job) {
        return (
            <Card className="w-full max-w-lg mx-auto">
                <CardContent className="pt-6 flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    <span className="ml-3 text-muted-foreground">Initializing job...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-lg mx-auto mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Progress Bar (Fake or Real) could go here */}

                {job.status === "failed" && (
                    <div className="text-destructive bg-destructive/10 p-3 rounded-md">
                        {job.error || "An unknown error occurred."}
                    </div>
                )}

                {job.status === "completed" && job.audio_url && (
                    <div className="pt-2">
                        <AudioPlayer audioUrl={job.audio_url} />
                    </div>
                )}

                {/* Cancel button could be added here for queued state */}
            </CardContent>
        </Card>
    );
}
