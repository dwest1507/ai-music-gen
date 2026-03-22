import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  Cpu,
  Server,
  LayoutTemplate,
  Shield,
  Github,
} from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "A portfolio project demonstrating full-stack AI engineering: serverless GPU deployment, FastAPI proxy, and a Next.js frontend.",
};

const TECH_STACK = [
  {
    icon: Cpu,
    title: "AI Inference",
    subtitle: "Modal (Serverless GPU)",
    accentColor: "#00ff88",
    description:
      "The open-source ACE-Step v1.5 music model was forked and extended with modal_app.py — a production-grade serverless deployment script. It packages the model into a Docker image, caches Hugging Face model weights during image build to avoid re-downloading on every cold start, and uses Modal's CRIU-based GPU memory snapshotting so warm starts are near-instant. GPU tier (L4, A10G, or A100) is automatically selected based on the configured LM model size (0.6B, 1.7B, or 4B). The app scales to zero when idle.",
    tags: [
      "ACE-Step v1.5",
      "Python",
      "Modal",
      "FastAPI",
      "CRIU memory snapshots",
      "Hugging Face",
      "Docker",
      "L4 / A10G / A100",
    ],
    link: {
      label: "View fork on GitHub",
      href: "https://github.com/dwest1507/ACE-Step-1.5-modal/tree/feature/modal-support",
    },
  },
  {
    icon: Server,
    title: "Backend API",
    subtitle: "FastAPI on Railway",
    accentColor: "#ff00ff",
    description:
      "A stateless HTTP proxy that sits between the browser and the Modal inference layer. All requests are validated with Pydantic, rate-limited per session with slowapi (5 generations/min), and routed to the upstream ACE-Step API over an HTTP/2 persistent connection managed by httpx.AsyncClient. Audio is streamed back to the client via FastAPI StreamingResponse, keeping the internal Modal URL and API key away from the browser at all times.",
    tags: [
      "Python",
      "FastAPI",
      "httpx HTTP/2",
      "Pydantic",
      "slowapi",
      "Docker",
      "Railway",
    ],
    link: null,
  },
  {
    icon: LayoutTemplate,
    title: "Frontend",
    subtitle: "Next.js on Vercel",
    accentColor: "#00d4ff",
    description:
      "A responsive web app with simple and advanced generation modes. Async job status is tracked via long-polling with exponential backoff. The waveform player is built on wavesurfer.js. All API shapes are validated client-side with Zod schemas matching the backend's Pydantic contracts, catching interface drift at the boundary. The frontend never contacts the Modal API directly — all traffic flows through the FastAPI backend.",
    tags: [
      "Next.js 16",
      "React 19",
      "TypeScript",
      "Tailwind CSS v4",
      "Zod",
      "wavesurfer.js",
      "Vitest",
      "Vercel",
    ],
    link: null,
  },
  {
    icon: Shield,
    title: "CI/CD & DevOps",
    subtitle: "GitHub Actions",
    accentColor: "#ffd700",
    description:
      "A multi-layered pipeline from commit to production. Pre-commit hooks (detect-secrets, Bandit, Semgrep, Ruff) catch issues locally before they reach CI. Every PR triggers SAST scanning, dependency auditing, container scanning (Trivy), and the full test suite with 100% coverage enforcement. Dependabot keeps all dependencies current. Release Please automates semantic versioning and changelog generation across the monorepo on every merge to main.",
    tags: [
      "GitHub Actions",
      "Gitleaks",
      "Bandit",
      "Semgrep",
      "Trivy",
      "pip-audit",
      "npm audit",
      "Dependabot",
      "Release Please",
      "pre-commit",
      "Pytest",
      "Vitest",
    ],
    link: null,
  },
];

const ARCHITECTURE = [
  { label: "Browser", sublabel: "Client" },
  { label: "Next.js 16", sublabel: "Vercel" },
  { label: "FastAPI", sublabel: "Railway" },
  { label: "ACE-Step API", sublabel: "Modal GPU" },
];

export default function About() {
  return (
    <div className="min-h-screen cyber-grid cyber-atmosphere flex flex-col items-center px-4 py-12 sm:px-8 sm:py-16">
      {/* Hero */}
      <header className="flex flex-col items-center gap-5 text-center mb-14 max-w-2xl">
        <div className="text-xs text-muted-foreground tracking-widest uppercase flex items-center gap-2">
          <span className="text-primary">›</span>
          <span>System</span>
          <span className="text-border">|</span>
          <span>Architecture</span>
          <span className="text-border">|</span>
          <span className="text-primary animate-pulse">v0.5.0</span>
        </div>

        <h1
          className="font-[family-name:var(--font-orbitron)] text-4xl sm:text-5xl font-black uppercase tracking-widest"
          style={{ color: "#00ff88", textShadow: "0 0 20px rgba(0,255,136,0.3)" }}
        >
          About This Project
        </h1>

        <p className="text-muted-foreground text-sm leading-relaxed tracking-wide max-w-lg">
          <span className="text-primary/60">{'// '}</span>
          Full-stack AI engineering — from forking and deploying an open-source
          music generation model on serverless GPU infrastructure, to building a
          production-grade web application on top of it.
        </p>

        <div className="flex gap-6 flex-wrap justify-center">
          <Link
            href="https://github.com/dwest1507/ai-music-gen"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-primary transition-colors"
          >
            <Github className="w-3.5 h-3.5" strokeWidth={1.5} />
            ai-music-gen
          </Link>
          <Link
            href="https://github.com/dwest1507/ACE-Step-1.5-modal/tree/feature/modal-support"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-primary transition-colors"
          >
            <Github className="w-3.5 h-3.5" strokeWidth={1.5} />
            ACE-Step-1.5-modal (fork)
          </Link>
        </div>
      </header>

      <main className="flex flex-col gap-10 w-full max-w-3xl">
        {/* Architecture Diagram */}
        <section aria-labelledby="arch-heading">
          <h2
            id="arch-heading"
            className="font-[family-name:var(--font-orbitron)] text-sm font-bold uppercase tracking-[0.15em] mb-6 text-center"
            style={{ color: "#00ff88", textShadow: "0 0 8px rgba(0,255,136,0.3)" }}
          >
            System Architecture
          </h2>
          <div className="overflow-x-auto">
            <div className="flex items-center gap-3 min-w-max mx-auto py-2 justify-center">
              {ARCHITECTURE.map((node, i) => (
                <div key={node.label} className="flex items-center gap-3">
                  <div
                    className="px-4 py-3 text-center min-w-[110px] border transition-all duration-200"
                    style={
                      i === ARCHITECTURE.length - 1
                        ? {
                            borderColor: "#00ff88",
                            background: "rgba(0,255,136,0.05)",
                            boxShadow: "0 0 10px rgba(0,255,136,0.2)",
                          }
                        : {
                            borderColor: "#2a2a3a",
                            background: "#12121a",
                          }
                    }
                  >
                    <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      {node.sublabel}
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide mt-0.5">
                      {node.label}
                    </p>
                  </div>
                  {i < ARCHITECTURE.length - 1 && (
                    <ArrowRight
                      className="w-4 h-4 shrink-0"
                      strokeWidth={1.5}
                      style={{ color: "#00ff88", opacity: 0.5 }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section aria-labelledby="stack-heading">
          <h2
            id="stack-heading"
            className="font-[family-name:var(--font-orbitron)] text-sm font-bold uppercase tracking-[0.15em] mb-6 text-center"
            style={{ color: "#00ff88", textShadow: "0 0 8px rgba(0,255,136,0.3)" }}
          >
            Tech Stack
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TECH_STACK.map(
              ({ icon: Icon, title, subtitle, accentColor, description, tags, link }) => (
                <Card key={title} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="p-2 border"
                        style={{
                          borderColor: accentColor + "40",
                          background: accentColor + "10",
                        }}
                      >
                        <Icon
                          className="w-4 h-4"
                          strokeWidth={1.5}
                          style={{ color: accentColor }}
                        />
                      </div>
                      <div>
                        <CardTitle
                          className="text-sm"
                          style={{ color: accentColor }}
                        >
                          {title}
                        </CardTitle>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground mt-0.5">
                          {subtitle}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 flex-1">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {description}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-auto">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[9px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {link && (
                      <Link
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-primary transition-colors mt-1 flex items-center gap-1"
                      >
                        <span className="text-primary">›</span>
                        {link.label}
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </section>
      </main>

      <footer className="mt-auto pt-20 text-center">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          <span className="text-primary/60">{'// '}</span>
          Developed by{" "}
          <a
            href="mailto:david.p.west2@gmail.com"
            className="hover:text-primary transition-colors"
          >
            David West
          </a>
        </p>
      </footer>
    </div>
  );
}
