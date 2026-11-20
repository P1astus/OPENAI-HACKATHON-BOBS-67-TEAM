import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAIN-08 // Autonomous AI Operations Engine",
  description: "Multi-step OpenAI agent with n8n execution, ElevenLabs voice briefings and quantified ROI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">{children}</body>
    </html>
  );
}
