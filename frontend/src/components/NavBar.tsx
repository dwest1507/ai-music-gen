"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Music } from "lucide-react";

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="w-full border-b border-border py-3 px-6 sm:px-8 flex items-center justify-between font-[family-name:var(--font-geist-sans)]">
      <Link
        href="/"
        className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
      >
        <Music className="w-4 h-4" />
        AI Music Gen
      </Link>
      <div className="flex gap-6 text-sm">
        <Link
          href="/"
          className={
            pathname === "/"
              ? "font-semibold text-primary"
              : "text-muted-foreground hover:text-primary transition-colors"
          }
        >
          Generator
        </Link>
        <Link
          href="/about"
          className={
            pathname === "/about"
              ? "font-semibold text-primary"
              : "text-muted-foreground hover:text-primary transition-colors"
          }
        >
          About
        </Link>
      </div>
    </nav>
  );
}
