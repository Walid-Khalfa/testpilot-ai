import { runRepo, projectRepo } from "@/lib/storage/file-store";
import Link from "next/link";
import Image from "next/image";
import { providerLabel } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await runRepo.get(id);
  if (!run) return <div>Run not found.</div>;
  const project = await projectRepo.get(run.projectId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Run {run.id.slice(0, 8)}</h1>
          <p className="text-slate-600">{project?.name} · {providerLabel(run.modelId)} ({run.modelId})</p>
        </div>
        <div className="flex gap-2">
          <a href={`/api/runs/${run.id}/report`} className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">Download report</a>
          <Link href={`/projects/${run.projectId}`} className="rounded border px-4 py-2 hover:bg-slate-50">Back</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Status" value={run.status} />
        <Stat label="Steps" value={String(run.steps.length)} />
        <Stat label="Assertions" value={`${run.assertions.filter((a) => a.passed).length}/${run.assertions.length}`} />
        <Stat label="Findings" value={String(run.findings.length)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Pages visited" value={String(run.pagesVisited)} />
        <Stat label="Prompt tokens" value={String(run.tokenUsage.promptTokens)} />
        <Stat label="Completion tokens" value={String(run.tokenUsage.completionTokens)} />
        <Stat label="Est. cost USD" value={run.estimatedCostUsd.toFixed(4)} />
      </div>

      {run.error && <div className="rounded bg-red-50 p-3 text-red-700">{run.error}</div>}

      <section>
        <h2 className="mb-3 text-xl font-semibold">Requirement coverage</h2>
        {run.requirements.length === 0 ? (
          <p className="text-slate-500">No explicit quoted requirements derived from the objective/instructions.</p>
        ) : (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="p-2 text-left">Requirement</th><th className="p-2 text-left">Source</th><th className="p-2 text-left">Status</th><th className="p-2 text-left">Evidence</th></tr></thead>
              <tbody>
                {run.requirements.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.text}</td>
                    <td className="p-2 text-xs">{r.source}</td>
                    <td className="p-2"><span className={`rounded px-2 py-0.5 text-xs ${reqColor(r.status)}`}>{r.status}</span></td>
                    <td className="p-2 text-xs">{r.evidence || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Scenarios</h2>
        {run.scenarios.length === 0 ? <p className="text-slate-500">None.</p> : run.scenarios.map((s) => (
          <div key={s.id} className="mb-2 rounded border bg-white p-3">
            <div className="font-semibold">{s.title}</div>
            <div className="text-sm text-slate-600">{s.objective}</div>
            <div className="text-xs text-slate-400">Priority: {s.priority} · Risk: {s.risk}</div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Timeline</h2>
        <ol className="space-y-1 rounded border bg-white p-4 text-sm">
          {run.timeline.map((t) => (
            <li key={t.id} className="flex flex-col gap-1">
              <div className="flex gap-2">
                <span className="font-mono text-xs text-slate-400">{t.timestamp.slice(11, 19)}</span>
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${kindColor(t.kind)}`}>{t.kind}</span>
                <span>{t.message}</span>
              </div>
              {t.kind === "reason" && (t.data as { reasoning?: string })?.reasoning ? (
                <div className="ml-6 text-xs italic text-slate-500">Rationale: {String((t.data as { reasoning?: string }).reasoning).slice(0, 400)}</div>
              ) : null}
              {t.kind === "reason" && (t.data as { visualObservation?: string; visionMode?: string })?.visualObservation ? (
                <div className="ml-6 text-xs text-indigo-700">
                  Visual observation ({String((t.data as { visionMode?: string }).visionMode || "multimodal")}): {String((t.data as { visualObservation?: string }).visualObservation).slice(0, 400)}
                </div>
              ) : null}
              {t.kind === "reason" && (t.data as { visionMode?: string })?.visionMode === "text_fallback" ? (
                <div className="ml-6 text-xs text-amber-700">Vision mode: text_fallback (multimodal request fell back to text-only)</div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Assertions</h2>
        {run.assertions.length === 0 ? <p className="text-slate-500">None.</p> : (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr><th className="p-2 text-left">Description</th><th className="p-2 text-left">Expected</th><th className="p-2 text-left">Actual</th><th className="p-2 text-left">Result</th><th className="p-2 text-left">Evidence</th></tr></thead>
              <tbody>
                {run.assertions.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="p-2">{a.description}</td>
                    <td className="p-2">{a.expected}</td>
                    <td className="p-2">{a.actual}</td>
                    <td className="p-2">{a.passed ? <span className="text-green-600 font-semibold">PASS</span> : <span className="text-red-600 font-semibold">FAIL</span>}</td>
                    <td className="p-2">{a.evidenceRef ? <Image src={shotUrl(a.evidenceRef)} alt="evidence" width={120} height={80} className="rounded border" unoptimized /> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Findings</h2>
        {run.findings.length === 0 ? <p className="text-slate-500">No findings.</p> : run.findings.map((f) => (
          <div key={f.id} className="mb-3 rounded border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{f.title}</span>
              <span className="rounded bg-red-200 px-2 py-0.5 text-xs">{f.severity}</span>
              <span className="rounded bg-yellow-200 px-2 py-0.5 text-xs">{f.status}</span>
            </div>
            <p className="mt-1 text-sm">{f.description}</p>
            <p className="text-sm"><b>Expected:</b> {f.expected}</p>
            <p className="text-sm"><b>Actual:</b> {f.actual}</p>
            <div className="mt-2 text-xs text-slate-600">
              <b>Repro steps:</b>
              <ol className="list-decimal pl-5">{f.reproSteps.map((r, i) => <li key={i}>{r}</li>)}</ol>
            </div>
            {f.evidenceRefs.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {f.evidenceRefs.map((e, i) => (
                  <Image key={i} src={shotUrl(e)} alt="evidence" width={160} height={100} className="rounded border" unoptimized />
                ))}
              </div>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Actions</h2>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Action</th><th className="p-2 text-left">Result</th><th className="p-2 text-left">Evidence</th></tr></thead>
            <tbody>
              {run.steps.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{i + 1}</td>
                  <td className="p-2 font-mono text-xs">{s.action.type}</td>
                  <td className="p-2">{s.ok ? <span className="text-green-600">OK</span> : <span className="text-red-600">FAIL</span>}</td>
                  <td className="p-2 text-xs">{s.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-white p-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function shotUrl(p: string): string {
  const rel = p.replace(/^\.data\//, "");
  return "/api/screenshots/" + rel;
}

function reqColor(s: string): string {
  switch (s) {
    case "passed": return "bg-green-100 text-green-700";
    case "failed": return "bg-red-100 text-red-700";
    case "blocked": return "bg-gray-200 text-gray-700";
    case "in_progress": return "bg-blue-100 text-blue-700";
    default: return "bg-amber-100 text-amber-700";
  }
}

function kindColor(kind: string): string {
  switch (kind) {
    case "error": return "bg-red-100 text-red-700";
    case "verify": return "bg-green-100 text-green-700";
    case "act": return "bg-blue-100 text-blue-700";
    case "plan": return "bg-purple-100 text-purple-700";
    case "observe": return "bg-amber-100 text-amber-700";
    default: return "bg-slate-100 text-slate-700";
  }
}