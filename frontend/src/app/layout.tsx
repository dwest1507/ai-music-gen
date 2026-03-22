import type { Metadata } from "next";
import { Orbitron, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
    <html lang="en">
      <body
        className={`${orbitron.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <NavBar />
        {children}
      </body>
    </html>
  );
}
