"use client";

import * as React from "react";
import { useState } from "react";
import { MusicGeneratorForm } from "@/components/MusicGeneratorForm";
import { JobStatus } from "@/components/JobStatus";
import { Music } from "lucide-react";

export default function Home() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const handleJobCreated = (jobId: string) => {
    setCurrentJobId(jobId);
  };

  return (
    <div className="min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)] flex flex-col items-center">
      <header className="flex flex-col items-center gap-4 text-center mb-8">
        <div className="p-4 rounded-full bg-primary/10">
          <Music className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">AI Music Generator</h1>
        <p className="text-muted-foreground text-lg max-w-xl">
          Create unique royalty-free music in seconds. Just describe the vibe, and our AI does the rest.
        </p>
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
              className="mt-8 text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
            >
              Generate Another Song
            </button>
          </div>
        )}
      </main>

      <footer className="mt-auto pt-16 text-center text-sm text-muted-foreground">
        <p>Developed by <a href="mailto:david.p.west2@gmail.com" className="hover:text-primary transition-colors underline underline-offset-4">David West</a></p>
        <p>GitHub: <a href="https://github.com/dwest1507/ai-music-gen" className="hover:text-primary transition-colors underline underline-offset-4">dwest1507/ai-music-gen</a></p>
      </footer>
    </div>
  );
}
