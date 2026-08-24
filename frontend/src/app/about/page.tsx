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
    accentColor: "#0ea5e9",
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
    accentColor: "#7c3aed",
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
    accentColor: "#38bdf8",
    description:
      "A responsive web app built around a single prompt box — everything else is optional. Async job status is tracked via long-polling with exponential backoff. The waveform player is built on wavesurfer.js. All API shapes are validated client-side with Zod schemas matching the backend's Pydantic contracts, catching interface drift at the boundary. The frontend never contacts the Modal API directly — all traffic flows through the FastAPI backend.",
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
    accentColor: "#db2777",
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
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-16 lg:py-24">
      {/* Hero */}
      <header className="mb-16 flex max-w-2xl flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
            System architecture
          </span>
        </div>

        <h1 className="headline-gradient text-4xl leading-none font-semibold tracking-[-0.03em] md:text-5xl lg:text-6xl">
          About This Project
        </h1>

        <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
          Full-stack AI engineering — from forking and deploying an open-source
          music generation model on serverless GPU infrastructure, to building a
          production-grade web application on top of it.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="https://github.com/dwest1507/ai-music-gen"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
          >
            <Github className="h-3.5 w-3.5" strokeWidth={1.5} />
            ai-music-gen
          </Link>
          <Link
            href="https://github.com/dwest1507/ACE-Step-1.5-modal/tree/feature/modal-support"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-primary"
          >
            <Github className="h-3.5 w-3.5" strokeWidth={1.5} />
            ACE-Step-1.5-modal (fork)
          </Link>
        </div>
      </header>

      <main className="flex w-full flex-col gap-16">
        {/* Architecture Diagram */}
        <section aria-labelledby="arch-heading">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground/60">
              Request path
            </span>
            <h2
              id="arch-heading"
              className="headline-gradient text-2xl font-semibold tracking-tight"
            >
              System Architecture
            </h2>
          </div>

          <div className="overflow-x-auto">
            <div className="mx-auto flex min-w-max items-center justify-center gap-3 py-2">
              {ARCHITECTURE.map((node, i) => (
                <div key={node.label} className="flex items-center gap-3">
                  <div
                    className={`min-w-[120px] rounded-xl border px-4 py-3 text-center transition-all duration-200 ${
                      i === ARCHITECTURE.length - 1
                        ? "border-primary/30 bg-primary/[0.06] shadow-[0_0_0_1px_rgba(14,165,233,0.2),0_0_40px_rgba(14,165,233,0.10)]"
                        : "surface-card border-white/[0.06]"
                    }`}
                  >
                    <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
                      {node.sublabel}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#ededef]">
                      {node.label}
                    </p>
                  </div>
                  {i < ARCHITECTURE.length - 1 && (
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-primary/50"
                      strokeWidth={1.5}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section aria-labelledby="stack-heading">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground/60">
              Every layer
            </span>
            <h2
              id="stack-heading"
              className="headline-gradient text-2xl font-semibold tracking-tight"
            >
              Tech Stack
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {TECH_STACK.map(
              ({ icon: Icon, title, subtitle, accentColor, description, tags, link }) => (
                <Card
                  key={title}
                  className="group flex flex-col hover:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_8px_40px_rgba(0,0,0,0.5),0_0_80px_rgba(14,165,233,0.08)]"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl border"
                        style={{
                          borderColor: `${accentColor}40`,
                          background: `${accentColor}14`,
                        }}
                      >
                        <Icon
                          className="h-4 w-4"
                          strokeWidth={1.5}
                          style={{ color: accentColor }}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{title}</CardTitle>
                        <p className="mt-1 font-mono text-[10px] tracking-widest text-muted-foreground">
                          {subtitle}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    {link && (
                      <Link
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border-t border-white/[0.06] pt-4 font-mono text-[10px] tracking-widest text-primary transition-colors duration-150 hover:text-primary-bright"
                      >
                        {link.label} ↗
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
