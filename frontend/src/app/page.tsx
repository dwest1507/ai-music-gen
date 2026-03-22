"use client";

import * as React from "react";
import { useState } from "react";
import { MusicGeneratorForm } from "@/components/MusicGeneratorForm";
import { JobStatus } from "@/components/JobStatus";

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const handleJobCreated = (jobId: string) => {
    setCurrentJobId(jobId);
  };

  return (
    <div className="min-h-screen cyber-grid cyber-atmosphere flex flex-col items-center px-4 py-12 sm:px-8 sm:py-16">
      <header className="flex flex-col items-center gap-5 text-center mb-12 max-w-2xl">
        {/* Terminal prompt line */}
        <div className="text-xs text-muted-foreground tracking-widest uppercase flex items-center gap-2">
          <span className="text-primary">›</span>
          <span>ACE-STEP v1.5</span>
          <span className="text-border">|</span>
          <span>MODAL GPU</span>
          <span className="text-border">|</span>
          <span className="text-primary animate-pulse">ONLINE</span>
        </div>

        {/* Glitch headline */}
        <h1
          className="font-[family-name:var(--font-orbitron)] text-4xl sm:text-5xl lg:text-6xl font-black uppercase tracking-widest cyber-glitch"
          style={{ color: "#00ff88" }}
        >
          AI Music Generator
        </h1>

        <p className="text-muted-foreground text-sm sm:text-base max-w-md leading-relaxed tracking-wide">
          <span className="text-primary/60">{'// '}</span>
          Describe the vibe. The neural net handles the rest.
          <span className="cursor-blink" />
        </p>

        {/* Accent line */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">init</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      </header>

      <main className="flex flex-col gap-8 w-full max-w-2xl items-center">
        {!currentJobId ? (
          <div className="w-full animate-in fade-in zoom-in duration-500">
            <MusicGeneratorForm onJobCreated={handleJobCreated} />
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-6">
            <JobStatus jobId={currentJobId} />

            <button
              onClick={() => setCurrentJobId(null)}
              className="mt-8 text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-primary transition-colors"
              style={{ fontFamily: "inherit" }}
            >
              <span className="text-primary mr-1">›</span>
              Generate Another Song
            </button>
          </div>
        )}
      </main>

      <footer className="mt-auto pt-20 text-center space-y-1">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          <span className="text-primary/60">{'// '}</span>
          Developed by{" "}
          <a
            href="mailto:david.p.west2@gmail.com"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            David West
          </a>
        </p>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          <a
            href="https://github.com/dwest1507/ai-music-gen"
            className="hover:text-primary transition-colors"
          >
            github/dwest1507/ai-music-gen
          </a>
        </p>
      </footer>
    </div>
  );
}
