"use client";

import * as React from "react";
import { useState } from "react";
import { MusicGeneratorForm } from "@/components/MusicGeneratorForm";
import { JobStatus } from "@/components/JobStatus";

const CAPABILITIES = ["ACE-Step v1.5", "Modal GPU", "AI-written lyrics", "MP3"];

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const handleJobCreated = (jobId: string) => {
    setCurrentJobId(jobId);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-16 lg:py-24">
      <header className="mb-14 flex max-w-2xl flex-col items-center gap-6 text-center">
        {/* Status badge */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
            Serverless GPU inference
          </span>
        </div>

        {/* Headline */}
        <div>
          <h1 className="headline-gradient text-5xl leading-none font-semibold tracking-[-0.03em] md:text-6xl lg:text-7xl">
            AI Music Generator
          </h1>
          <div className="mt-4 flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-primary/50" />
            <h2 className="font-mono text-sm tracking-widest text-primary md:text-base">
              Text to song
            </h2>
            <span className="h-px w-12 bg-primary/50" />
          </div>
        </div>

        {/* Tagline */}
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          Describe the vibe. The model handles arrangement, lyrics, and mastering.
        </p>

        {/* Capability chips */}
        <div className="flex flex-wrap justify-center gap-1.5">
          {CAPABILITIES.map((capability) => (
            <span
              key={capability}
              className="rounded-full border border-white/[0.08] px-2.5 py-0.5 font-mono text-[10px] tracking-widest text-muted-foreground"
            >
              {capability}
            </span>
          ))}
        </div>
      </header>

      <main className="flex w-full max-w-2xl flex-col items-center gap-8">
        {!currentJobId ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 w-full duration-500">
            <MusicGeneratorForm onJobCreated={handleJobCreated} />
          </div>
        ) : (
          <div className="flex w-full flex-col items-center gap-6">
            <JobStatus jobId={currentJobId} />

            <button
              onClick={() => setCurrentJobId(null)}
              className="mt-4 cursor-pointer rounded-lg px-4 py-2 font-mono text-[11px] tracking-widest text-muted-foreground transition-colors duration-150 hover:bg-white/[0.05] hover:text-[#ededef]"
            >
              Generate Another Song
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
