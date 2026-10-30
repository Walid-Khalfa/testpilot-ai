import { projectRepo, runRepo } from "@/lib/storage/file-store";
import Link from "next/link";
import { RunButton } from "./RunButton";
import { RequirementsUpload } from "./RequirementsUpload";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await projectRepo.get(id);
  if (!project) return <div>Project not found.</div>;
  const runs = (await runRepo.list()).filter((r) => r.projectId === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          <p className="text-slate-600">{project.targetUrl}</p>
        </div>
        <RunButton projectId={project.id} />
      </div>
      <RequirementsUpload projectId={project.id} />
      <div className="rounded border bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Configuration</h2>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-slate-500">Objective</dt><dd>{project.objective}</dd>
          <dt className="text-slate-500">Authorized domain</dt><dd>{project.authorizedDomain}</dd>
          <dt className="text-slate-500">Max duration</dt><dd>{project.maxDurationSec}s</dd>
          <dt className="text-slate-500">Max steps</dt><dd>{project.maxSteps}</dd>
          <dt className="text-slate-500">Max pages</dt><dd>{project.maxPages}</dd>
          <dt className="text-slate-500">Max tokens</dt><dd>{project.maxTokens}</dd>
        </dl>
      </div>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Runs</h2>
        {runs.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-slate-500">No runs yet. Click &quot;Run test&quot;.</div>
        ) : (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Started</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Steps</th>
                  <th className="p-2 text-left">Assertions</th>
                  <th className="p-2 text-left">Findings</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-2 text-xs">{r.startedAt}</td>
                    <td className="p-2"><span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{r.status}</span></td>
                    <td className="p-2">{r.steps.length}</td>
                    <td className="p-2">{r.assertions.filter((a) => a.passed).length}/{r.assertions.length}</td>
                    <td className="p-2">{r.findings.length}</td>
                    <td className="p-2"><Link href={`/runs/${r.id}`} className="text-indigo-600 hover:underline">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}