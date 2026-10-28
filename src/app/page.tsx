import Link from "next/link";
import { projectRepo, runRepo } from "@/lib/storage/file-store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const projects = await projectRepo.list();
  const runs = await runRepo.list();
  const recentRuns = runs.slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-slate-600">Autonomous, verifiable QA testing runs.</p>
        </div>
        <Link href="/projects/new" className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700">
          New project
        </Link>
      </div>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Projects</h2>
        {projects.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-slate-500">
            No projects yet. <Link href="/projects/new" className="text-indigo-600 underline">Create one</Link>.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="rounded border bg-white p-4 shadow-sm hover:shadow">
                <div className="font-semibold">{p.name}</div>
                <div className="truncate text-sm text-slate-500">{p.targetUrl}</div>
                <div className="mt-2 text-xs text-slate-400">{p.objective}</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Recent runs</h2>
        {recentRuns.length === 0 ? (
          <div className="rounded border border-dashed p-6 text-center text-slate-500">No runs yet.</div>
        ) : (
          <div className="overflow-x-auto rounded border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Project</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Steps</th>
                  <th className="p-2 text-left">Assertions</th>
                  <th className="p-2 text-left">Findings</th>
                  <th className="p-2 text-left">Model</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((r) => {
                  const proj = projects.find((p) => p.id === r.projectId);
                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-2">{proj?.name || r.projectId}</td>
                      <td className="p-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${statusColor(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="p-2">{r.steps.length}</td>
                      <td className="p-2">{r.assertions.filter((a) => a.passed).length}/{r.assertions.length}</td>
                      <td className="p-2">{r.findings.length}</td>
                      <td className="p-2 text-xs">{r.modelId}</td>
                      <td className="p-2">
                        <Link href={`/runs/${r.id}`} className="text-indigo-600 hover:underline">View</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case "completed": return "bg-green-100 text-green-700";
    case "running": return "bg-blue-100 text-blue-700";
    case "failed": return "bg-red-100 text-red-700";
    case "cancelled": return "bg-gray-200 text-gray-700";
    default: return "bg-slate-100 text-slate-700";
  }
}