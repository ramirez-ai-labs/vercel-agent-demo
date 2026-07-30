import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sandbox Agent Demo",
  description:
    "Generates a script with an LLM via AI Gateway, then runs it in an isolated Vercel Sandbox.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
