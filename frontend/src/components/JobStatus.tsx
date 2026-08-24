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
        color: "#8a8f98",
        label: "Queued",
        icon: Loader2,
        spin: true,
    },
    processing: {
        color: "#38bdf8",
        label: "Processing",
        icon: Loader2,
        spin: true,
    },
    completed: {
        color: "#0ea5e9",
        label: "Complete",
        icon: CheckCircle2,
        spin: false,
    },
    failed: {
        color: "#f43f5e",
        label: "Failed",
        icon: XCircle,
        spin: false,
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
                <CardContent className="flex items-center gap-3 pt-6 text-destructive">
                    <AlertCircle className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                    <p className="text-sm">{error}</p>
                </CardContent>
            </Card>
        );
    }

    if (!job) {
        return (
            <Card className="w-full max-w-2xl mx-auto">
                <CardContent className="flex items-center justify-center gap-3 py-10 pt-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" strokeWidth={1.5} />
                    <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
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
                ? { boxShadow: "0 0 0 1px rgba(14,165,233,0.25), 0 8px 40px rgba(0,0,0,0.5), 0 0 80px rgba(14,165,233,0.10)" }
                : job.status === "failed"
                ? { boxShadow: "0 0 0 1px rgba(244,63,94,0.25), 0 8px 40px rgba(0,0,0,0.5)" }
                : undefined
            }
        >
            {/* Job header strip */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-3">
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground/60">
                    job:{jobId.slice(0, 8)}
                </span>
                {statusConfig && (
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] tracking-widest"
                        style={{
                            color: statusConfig.color,
                            borderColor: `${statusConfig.color}4d`,
                            background: `${statusConfig.color}14`,
                        }}
                    >
                        <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: statusConfig.color }}
                        />
                        {statusConfig.label}
                    </span>
                )}
            </div>

            <CardHeader className="pt-5 pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <StatusIcon
                        className={`h-4 w-4 ${statusConfig?.spin ? "animate-spin" : ""}`}
                        strokeWidth={1.5}
                        style={{ color: statusConfig?.color ?? "#8a8f98" }}
                    />
                    <span style={{ color: statusConfig?.color ?? "#ededef" }}>
                        {(job.status === "queued" || job.status === "processing") && GENERATING_MESSAGES[generatingMessageIndex]}
                        {job.status === "completed" && "Generation Complete!"}
                        {job.status === "failed" && "Generation Failed"}
                    </span>
                </CardTitle>

                {job.metadata && (job.metadata.prompt || job.metadata.genre) && (
                    <CardDescription className="mt-1 line-clamp-2 text-xs italic">
                        &quot;{job.metadata.prompt}&quot;
                    </CardDescription>
                )}
            </CardHeader>

            <CardContent className="space-y-5">
                {/* Metadata Badges */}
                {job.metadata && (
                    <div className="flex flex-wrap gap-2 border-t border-white/[0.08] pt-3">
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
                        role="alert"
                        className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/[0.08] p-3 text-[13px] text-destructive"
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
                                    <h4 className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted-foreground">
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
