"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Music } from "lucide-react";

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="w-full border-b border-border bg-background/95 backdrop-blur-sm py-3 px-6 sm:px-8 flex items-center justify-between"
      style={{ boxShadow: "0 1px 0 #2a2a3a, 0 2px 20px rgba(0,255,136,0.05)" }}
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 group"
      >
        <Music
          className="w-4 h-4 text-primary transition-all duration-200"
          strokeWidth={1.5}
          style={{ filter: "drop-shadow(0 0 4px #00ff88)" }}
        />
        <span
          className="font-[family-name:var(--font-orbitron)] text-sm font-bold uppercase tracking-widest text-primary"
          style={{ textShadow: "0 0 8px rgba(0,255,136,0.4)" }}
        >
          AI Music Gen
        </span>
      </Link>

      <div className="flex gap-6 items-center">
        <Link
          href="/"
          className={[
            "text-xs uppercase tracking-[0.15em] transition-all duration-150",
            pathname === "/"
              ? "font-semibold text-primary"
              : "font-medium text-muted-foreground hover:text-primary",
          ].join(" ")}
          style={pathname === "/" ? { textShadow: "0 0 8px rgba(0,255,136,0.5)" } : undefined}
        >
          {pathname === "/" && <span className="mr-1 text-primary">›</span>}
          Generator
        </Link>
        <Link
          href="/about"
          className={[
            "text-xs uppercase tracking-[0.15em] transition-all duration-150",
            pathname === "/about"
              ? "font-semibold text-primary"
              : "font-medium text-muted-foreground hover:text-primary",
          ].join(" ")}
          style={pathname === "/about" ? { textShadow: "0 0 8px rgba(0,255,136,0.5)" } : undefined}
        >
          {pathname === "/about" && <span className="mr-1 text-primary">›</span>}
          About
        </Link>
      </div>
    </nav>
  );
}
