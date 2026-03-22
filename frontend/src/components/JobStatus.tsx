"use client";

import * as React from "react";
import { useEffect, useState, useRef } from "react";
import { apiFetch, JobResponse } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock, Activity, Hash, FileAudio, Music } from "lucide-react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Badge } from "@/components/ui/badge";

const GENERATING_MESSAGES = [
    "Generating Music...",
    "Now the AI is doing its thing...",
    "Longer prompts take more time to process...",
    "The model is crafting your audio, note by note...",
    "Still generating... this is the hard part...",
    "Composing, mixing, mastering... all at once...",
    "Your prompt was pretty complex, huh?",
    "The AI is really thinking about this one...",
    "Fine. It's being creative. Let it cook.",
    "A great song takes time. Even for robots.",
    "Did you use a lot of lyrics? That's probably why...",
    "The GPU is sweating a little, not gonna lie...",
    "We're talking real-time music synthesis here...",
    "Beethoven took years. This'll take minutes. Maybe.",
    "The AI has excellent taste and refuses to rush...",
    "Still running... have you tried a shorter prompt?",
    "I mean, it IS generating something spectacular...",
    "Any minute now...",
];

interface JobStatusProps {
    jobId: string;
}

const STATUS_CONFIG = {
    queued: {
        color: "#ffd700",
        label: "Queued",
        icon: Loader2,
        spin: true,
        shadow: "0 0 6px #ffd700",
    },
    processing: {
        color: "#00d4ff",
        label: "Processing",
        icon: Loader2,
        spin: true,
        shadow: "0 0 6px #00d4ff",
    },
    completed: {
        color: "#00ff88",
        label: "Complete",
        icon: CheckCircle2,
        spin: false,
        shadow: "0 0 8px #00ff88",
    },
    failed: {
        color: "#ff3366",
        label: "Failed",
        icon: XCircle,
        spin: false,
        shadow: "0 0 6px #ff3366",
    },
} as const;

export function JobStatus({ jobId }: JobStatusProps) {
    const [job, setJob] = useState<JobResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(true);
    const [generatingMessageIndex, setGeneratingMessageIndex] = useState(0);
    const generatingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        let isMounted = true;
        const startTime = Date.now();
        const MAX_POLLING_TIME = 10 * 60 * 1000;

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

    useEffect(() => {
        const isActive = job?.status === "queued" || job?.status === "processing";
        if (!isActive) {
            if (generatingIntervalRef.current) {
                clearInterval(generatingIntervalRef.current);
                generatingIntervalRef.current = null;
            }
            return;
        }
        if (generatingIntervalRef.current) return;
        generatingIntervalRef.current = setInterval(() => {
            setGeneratingMessageIndex(prev =>
                prev < GENERATING_MESSAGES.length - 1 ? prev + 1 : prev
            );
        }, 10000);
        return () => {
            if (generatingIntervalRef.current) {
                clearInterval(generatingIntervalRef.current);
                generatingIntervalRef.current = null;
            }
        };
    }, [job?.status]);

    if (error) {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardContent className="pt-6 flex items-center gap-3" style={{ color: "#ff3366" }}>
                    <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 4px #ff3366)" }} />
                    <p className="text-sm">{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (!job) {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardContent className="pt-6 flex items-center justify-center py-10 gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#00ff88" }} strokeWidth={1.5} />
                    <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        Initializing job...
                    </span>
                </CardContent>
            </Card>
        );
    }

    const audioUrls = job.audio_urls || (job.audio_url ? [job.audio_url] : []);
    const statusConfig = STATUS_CONFIG[job.status as keyof typeof STATUS_CONFIG];
    const StatusIcon = statusConfig?.icon ?? AlertCircle;

    return (
        <Card
            className="w-full max-w-2xl mx-auto mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={job.status === "completed"
                ? { borderColor: "#00ff8840", boxShadow: "0 0 20px rgba(0,255,136,0.08)" }
                : job.status === "failed"
                ? { borderColor: "#ff336640" }
                : {}
            }
        >
            {/* Terminal header */}
            <div
                className="flex items-center justify-between px-4 py-2 border-b"
                style={{ borderColor: "#2a2a3a", background: "#0a0a0f" }}
            >
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: "#ff3366", boxShadow: "0 0 3px #ff3366" }} />
                    <span className="w-2 h-2 rounded-full" style={{ background: "#ffd700", boxShadow: "0 0 3px #ffd700" }} />
                    <span className="w-2 h-2 rounded-full" style={{ background: "#00ff88", boxShadow: "0 0 3px #00ff88" }} />
                </div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    job:{jobId.slice(0, 8)}
                </span>
                {statusConfig && (
                    <span
                        className="text-[10px] uppercase tracking-[0.15em] font-medium"
                        style={{ color: statusConfig.color, textShadow: statusConfig.shadow }}
                    >
                        {statusConfig.label}
                    </span>
                )}
            </div>

            <CardHeader className="pb-2 pt-5">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <StatusIcon
                        className={`w-4 h-4 ${statusConfig?.spin ? "animate-spin" : ""}`}
                        strokeWidth={1.5}
                        style={{
                            color: statusConfig?.color ?? "#6b7280",
                            filter: statusConfig ? `drop-shadow(0 0 4px ${statusConfig.color})` : undefined,
                        }}
                    />
                    <span style={{ color: statusConfig?.color ?? "#e0e0e0" }}>
                        {(job.status === "queued" || job.status === "processing") && GENERATING_MESSAGES[generatingMessageIndex]}
                        {job.status === "completed" && "Generation Complete!"}
                        {job.status === "failed" && "Generation Failed"}
                    </span>
                </CardTitle>

                {job.metadata && (job.metadata.prompt || job.metadata.genre) && (
                    <CardDescription className="italic line-clamp-2 mt-1 text-xs">
                        &quot;{job.metadata.prompt}&quot;
                    </CardDescription>
                )}
            </CardHeader>

            <CardContent className="space-y-5">
                {/* Metadata Badges */}
                {job.metadata && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: "#2a2a3a" }}>
                        {job.metadata.duration && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" strokeWidth={1.5} /> {job.metadata.duration}s
                            </Badge>
                        )}
                        {job.metadata.bpm && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Activity className="w-2.5 h-2.5" strokeWidth={1.5} /> {job.metadata.bpm} BPM
                            </Badge>
                        )}
                        {job.metadata.key_scale && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Music className="w-2.5 h-2.5" strokeWidth={1.5} /> {job.metadata.key_scale}
                            </Badge>
                        )}
                        {job.metadata.time_signature && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                                <Hash className="w-2.5 h-2.5" strokeWidth={1.5} /> {job.metadata.time_signature}
                            </Badge>
                        )}
                    </div>
                )}

                {job.status === "failed" && (
                    <div
                        className="text-xs p-3 flex items-start gap-2"
                        style={{
                            color: "#ff3366",
                            background: "rgba(255,51,102,0.08)",
                            border: "1px solid rgba(255,51,102,0.3)",
                        }}
                    >
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.5} />
                        <span>{job.error || "An unknown error occurred."}</span>
                    </div>
                )}

                {job.status === "completed" && audioUrls.length > 0 && (
                    <div className="space-y-5 pt-3">
                        {audioUrls.map((url, index) => (
                            <div key={index} className="space-y-2">
                                {audioUrls.length > 1 && (
                                    <h4 className="text-[10px] uppercase tracking-[0.15em] font-medium flex items-center gap-2 text-muted-foreground">
                                        <FileAudio className="w-3.5 h-3.5" strokeWidth={1.5} />
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
