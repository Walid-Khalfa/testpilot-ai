"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RunButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create run");
      const runId = data.run.id;
      const execRes = await fetch(`/api/runs/${runId}/execute`, { method: "POST" });
      const execData = await execRes.json();
      if (!execRes.ok) throw new Error(execData.error || "Execution failed");
      router.push(`/runs/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button onClick={run} disabled={loading} className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50">
        {loading ? "Running..." : "Run test"}
      </button>
      {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
    </div>
  );
}