"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
    audioUrl: string;
    className?: string;
}

export function AudioPlayer({ audioUrl, className }: AudioPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        if (!containerRef.current) return;

        wavesurferRef.current = WaveSurfer.create({
            container: containerRef.current,
            waveColor: "#a1a1aa",
            progressColor: "#18181b", // darker color for progress
            cursorColor: "#18181b",
            barWidth: 2,
            barGap: 3,
            height: 60,
            normalize: true,
            url: audioUrl,
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
    }, [audioUrl]);

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
        const link = document.createElement("a");
        link.href = audioUrl;
        link.download = "generated-music.wav";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={cn("w-full bg-card border rounded-lg p-4 shadow-sm", className)}>
            <div
                ref={containerRef}
                className={cn("w-full mb-4", !isReady && "opacity-50 pointer-events-none")}
            />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        size="icon"
                        variant="outline"
                        onClick={togglePlay}
                        disabled={!isReady}
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>

                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={toggleMute}
                        disabled={!isReady}
                    >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                </div>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownload}
                    disabled={!isReady}
                    className="gap-2"
                >
                    <Download className="h-4 w-4" />
                    Download
                </Button>
            </div>
        </div>
    );
}
