import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { AmbientBackground } from "@/components/layout/AmbientBackground";
import { Footer } from "@/components/layout/Footer";
import { API_BASE_URL } from "@/lib/api";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI Music Gen",
    template: "%s — AI Music Gen",
  },
  description:
    "Generate royalty-free music in seconds using AI. Powered by ACE-Step v1.5 deployed on Modal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* The first call to the API is the prewarm, fired on the visitor's
            first interaction. Resolving DNS and completing the TLS handshake
            ahead of it keeps that moment as early as possible.

            use-credentials, not anonymous: every API call goes out with
            credentials: "include", and the browser keeps credentialed and
            anonymous connections in separate pools. An anonymous preconnect
            would warm a pool nothing then uses, paying the handshake twice. */}
        <link rel="preconnect" href={API_BASE_URL} crossOrigin="use-credentials" />
        <link rel="dns-prefetch" href={API_BASE_URL} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        <AmbientBackground />
        <NavBar />
        <main className="relative z-10 flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
