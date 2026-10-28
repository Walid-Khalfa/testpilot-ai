"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULTS = {
  name: "Demo Shop Checkout",
  targetUrl: "http://localhost:3000/demo-shop/index.html",
  authorizedDomain: "localhost",
  objective: "Verify the checkout form submits and displays an order confirmation.",
  maxDurationSec: 120,
  maxSteps: 20,
  maxPages: 10,
  maxTokens: 50000,
  instructions: "Use synthetic test data only. Do not submit real payments.",
};

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState(DEFAULTS);
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm) { setError("You must confirm authorization to test this target."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, confirmAuthorization: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create project");
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold">New testing project</h1>
      <form onSubmit={submit} className="space-y-4 rounded border bg-white p-6 shadow-sm">
        <Field label="Project name" value={form.name} onChange={(v) => set("name", v)} />
        <Field label="Target URL" value={form.targetUrl} onChange={(v) => set("targetUrl", v)} />
        <Field label="Authorized domain" value={form.authorizedDomain} onChange={(v) => set("authorizedDomain", v)} />
        <Field label="Testing objective" value={form.objective} onChange={(v) => set("objective", v)} textarea />
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Max duration (s)" value={form.maxDurationSec} onChange={(v) => set("maxDurationSec", v)} />
          <NumField label="Max steps" value={form.maxSteps} onChange={(v) => set("maxSteps", v)} />
          <NumField label="Max pages" value={form.maxPages} onChange={(v) => set("maxPages", v)} />
          <NumField label="Max tokens" value={form.maxTokens} onChange={(v) => set("maxTokens", v)} />
        </div>
        <Field label="Optional instructions" value={form.instructions} onChange={(v) => set("instructions", v)} textarea />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
          <span>I confirm I own or am explicitly authorized to test this application and accept the scope limits.</span>
        </label>
        {error && <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button type="submit" disabled={loading} className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Creating..." : "Create project"}
        </button>
      </form>
      <p className="mt-4 text-xs text-slate-500">
        Note: localhost targets require ALLOW_LOCAL_DEMO=true (enabled for local development).
      </p>
    </div>
  );
}

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border px-3 py-2" rows={3} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded border px-3 py-2" />
      )}
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded border px-3 py-2" />
    </div>
  );
}