"use client";
import { useState } from "react";

export function RequirementsUpload({ projectId }: { projectId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setLoading(true); setMsg(null);
    try {
      const content = await file.text();
      const res = await fetch("/api/requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, filename: file.name, mimeType: file.type || "text/plain", content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setMsg(`Uploaded ${file.name}: ${data.document.requirements.length} requirement(s) extracted.`);
      form.reset();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded border bg-white p-4 shadow-sm">
      <h2 className="mb-2 font-semibold">Upload specification (RAG)</h2>
      <form onSubmit={submit} className="flex items-center gap-2">
        <input type="file" name="file" accept=".txt,.md,text/plain,text/markdown" className="text-sm" />
        <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
      <p className="mt-2 text-xs text-slate-500">Max 64 KB. Supports .txt and .md. Quoted requirements are extracted deterministically.</p>
    </div>
  );
}