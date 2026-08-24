"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Music } from "lucide-react";

const NAV_LINKS = [
    { href: "/", label: "Generator" },
    { href: "/about", label: "About" },
];

export function NavBar() {
    const pathname = usePathname();

    return (
        <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#050506]/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-2">
                {/* Brand */}
                <Link
                    href="/"
                    className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold tracking-tight text-[#ededef] transition-colors duration-200 hover:text-white"
                >
                    <Music className="h-4 w-4 text-primary" strokeWidth={1.5} />
                    <span>
                        AI Music Gen<span className="text-primary">.</span>
                    </span>
                </Link>

                <div className="flex items-center gap-6">
                    <nav aria-label="Main navigation" className="flex items-center gap-6">
                        {NAV_LINKS.map(({ href, label }) => (
                            <Link
                                key={href}
                                href={href}
                                aria-current={pathname === href ? "page" : undefined}
                                className={[
                                    "inline-flex min-h-[44px] items-center text-sm transition-colors duration-200",
                                    pathname === href
                                        ? "font-semibold text-primary"
                                        : "text-muted-foreground hover:text-[#ededef]",
                                ].join(" ")}
                            >
                                {label}
                            </Link>
                        ))}
                    </nav>

                    <a
                        href="mailto:david.p.west2@gmail.com"
                        className="hidden rounded-lg bg-primary px-4 py-2 text-sm font-medium text-[#082f49] shadow-[0_0_0_1px_rgba(14,165,233,0.5),0_4px_12px_rgba(14,165,233,0.25),inset_0_1px_0_0_rgba(255,255,255,0.15)] transition-all duration-200 hover:bg-[#38bdf8] hover:shadow-[0_0_0_1px_rgba(14,165,233,0.6),0_4px_20px_rgba(14,165,233,0.35),inset_0_1px_0_0_rgba(255,255,255,0.15)] active:scale-[0.98] sm:block"
                    >
                        Get in Touch
                    </a>
                </div>
            </div>
        </header>
    );
}
