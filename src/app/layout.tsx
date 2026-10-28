import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TestPilot AI",
  description: "Autonomous, verifiable AI-powered QA testing agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="border-b bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-xl font-bold text-indigo-600">TestPilot AI</Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-indigo-600">Dashboard</Link>
              <Link href="/projects/new" className="hover:text-indigo-600">New project</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}