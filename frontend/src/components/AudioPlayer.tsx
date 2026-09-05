"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/api";

interface AudioPlayerProps {
    audioUrl: string;
    className?: string;
}

export function AudioPlayer({ audioUrl, className }: AudioPlayerProps) {
    const fullAudioUrl = audioUrl.startsWith("/") ? `${API_BASE_URL}${audioUrl}` : audioUrl;
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    // Pull the song into memory once, then serve both playback and download from
    // it. The audio lives on the GPU container's ephemeral disk and disappears
    // when it scales to zero, so a Download that goes back to the network 404s
    // once the container is gone. Holding it here makes Download work for the
    // life of the page — as long as the task id survives anyway.
    useEffect(() => {
        let cancelled = false;
        let created: string | null = null;

        (async () => {
            try {
                const response = await fetch(fullAudioUrl, { credentials: "include" });
                if (!response.ok) return;
                const blob = await response.blob();
                if (cancelled) return;
                created = URL.createObjectURL(blob);
                setObjectUrl(created);
            } catch {
                // Leave objectUrl null; the player simply stays un-ready.
            }
        })();

        return () => {
            cancelled = true;
            if (created) URL.revokeObjectURL(created);
        };
    }, [fullAudioUrl]);

    useEffect(() => {
        if (!containerRef.current || !objectUrl) return;

        wavesurferRef.current = WaveSurfer.create({
            container: containerRef.current,
            waveColor: "rgba(255,255,255,0.14)",
            progressColor: "#0ea5e9",
            cursorColor: "#38bdf8",
            barWidth: 2,
            barGap: 3,
            height: 56,
            normalize: true,
            url: objectUrl,
        });

        wavesurferRef.current.on("ready", () => {
            setIsReady(true);
        });

        wavesurferRef.current.on("play", () => setIsPlaying(true));
        wavesurferRef.current.on("pause", () => setIsPlaying(false));
        wavesurferRef.current.on("finish", () => setIsPlaying(false));

        return () => {
            wavesurferRef.current?.destroy();
        };
    }, [objectUrl]);

    const togglePlay = () => {
        wavesurferRef.current?.playPause();
    };

    const toggleMute = () => {
        if (!wavesurferRef.current) return;
        const newMuteState = !isMuted;
        wavesurferRef.current.setMuted(newMuteState);
        setIsMuted(newMuteState);
    };

    const handleDownload = () => {
        if (!objectUrl) return;
        const link = document.createElement("a");
        // The in-memory copy, not the network — see the fetch effect above.
        link.href = objectUrl;

        let filename = "generated-music.mp3";
        try {
            const urlObj = new URL(fullAudioUrl,
                fullAudioUrl.startsWith("http") ? undefined : window.location.origin
            );

            const parts = urlObj.pathname.split("/");
            const taskId = parts[parts.length - 1];
            if (taskId && taskId !== "audio") {
                filename = `music_${taskId}.mp3`;
            }

            const pathParam = urlObj.searchParams.get("path");
            if (pathParam && pathParam.includes(".")) {
                const pathParts = pathParam.split("/");
                filename = pathParts[pathParts.length - 1];
            }
        } catch {
            if (fullAudioUrl.includes("wav")) filename = "generated-music.wav";
            else if (fullAudioUrl.includes("flac")) filename = "generated-music.flac";
        }

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div
            className={cn(
                "w-full rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-xl transition-shadow duration-300",
                className
            )}
            style={{
                boxShadow: isPlaying
                    ? "0 0 0 1px rgba(14,165,233,0.25), 0 8px 32px rgba(0,0,0,0.3), 0 0 60px rgba(14,165,233,0.10)"
                    : "0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.3)",
            }}
        >
            <div
                ref={containerRef}
                className={cn("w-full mb-4", !isReady && "opacity-30 pointer-events-none")}
            />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        size="icon"
                        variant="default"
                        onClick={togglePlay}
                        disabled={!isReady}
                    >
                        {isPlaying
                            ? <Pause className="h-3.5 w-3.5" strokeWidth={1.5} />
                            : <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                        }
                    </Button>

                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={toggleMute}
                        disabled={!isReady}
                    >
                        {isMuted
                            ? <VolumeX className="h-3.5 w-3.5" strokeWidth={1.5} />
                            : <Volume2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        }
                    </Button>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!isReady}
                    className="gap-1.5"
                >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Download
                </Button>
            </div>
        </div>
    );
}
