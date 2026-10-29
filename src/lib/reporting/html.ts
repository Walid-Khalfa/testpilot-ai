import type { Run, Project } from "../schemas";
import fs from "node:fs";
import path from "node:path";

export function renderReportHtml(run: Run, project: Project): string {
  const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const embedShot = (p: string): string => {
    try {
      const rel = p.replace(/^\.data\//, "");
      const file = path.resolve(process.cwd(), ".data", rel);
      const buf = fs.readFileSync(file);
      return `<img src="data:image/png;base64,${buf.toString("base64")}" alt="evidence" style="max-width:320px;border:1px solid #ddd;border-radius:.25rem;margin:.25rem 0" />`;
    } catch {
      return `<span class="ev">Evidence: ${esc(p)}</span>`;
    }
  };
  const stepRows = run.steps
    .map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.action.type)}</td><td>${s.ok ? "OK" : "FAIL"}</td><td>${esc(s.evidence)}</td><td>${s.screenshotPath ? embedShot(s.screenshotPath) : "—"}</td><td>${s.durationMs}ms</td></tr>`)
    .join("");
  const assertionRows = run.assertions
    .map((a) => `<tr><td>${esc(a.description)}</td><td>${esc(a.expected)}</td><td>${esc(a.actual)}</td><td>${a.passed ? "PASS" : "FAIL"}</td></tr>`)
    .join("");
  const findingBlocks = run.findings
    .map((f) => `<div class="finding"><h3>${esc(f.title)} <span class="sev">${esc(f.severity)}</span> <span class="status">${esc(f.status)}</span></h3><p>${esc(f.description)}</p><p><b>Expected:</b> ${esc(f.expected)}</p><p><b>Actual:</b> ${esc(f.actual)}</p><h4>Reproduction steps</h4><ol>${f.reproSteps.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>${f.evidenceRefs.map((e) => `<div>${embedShot(e)}</div>`).join("")}</div>`)
    .join("");
  const scenarioBlocks = run.scenarios
    .map((s) => `<div><h3>${esc(s.title)}</h3><p>${esc(s.objective)}</p><p>Priority: ${esc(s.priority)} · Risk: ${esc(s.risk)}</p></div>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>TestPilot AI Report - ${esc(project.name)}</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:2rem;color:#111;line-height:1.5}
h1{margin-bottom:.25rem} h2{margin-top:2rem;border-bottom:1px solid #ddd;padding-bottom:.25rem}
table{border-collapse:collapse;width:100%;font-size:.9rem} th,td{border:1px solid #ddd;padding:.4rem;text-align:left;vertical-align:top}
th{background:#f5f5f5} .finding{border:1px solid #e0a; padding:1rem; margin:1rem 0; border-radius:.5rem; background:#fff5fa}
.sev{background:#eee;padding:.1rem .4rem;border-radius:.25rem;font-size:.75rem} .status{background:#ffe;padding:.1rem .4rem;border-radius:.25rem;font-size:.75rem}
.ev{font-family:monospace;font-size:.8rem;color:#555}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.meta div{background:#f9f9f9;padding:.5rem;border-radius:.25rem}
</style>
</head>
<body>
<h1>TestPilot AI — QA Report</h1>
<p>Generated ${esc(new Date().toISOString())}</p>
<h2>Metadata</h2>
<div class="meta">
<div><b>Project</b><br/>${esc(project.name)}</div>
<div><b>Target URL</b><br/>${esc(project.targetUrl)}</div>
<div><b>Authorized domain</b><br/>${esc(project.authorizedDomain)}</div>
<div><b>Model</b><br/>${esc(run.modelId.includes("Muse") ? "Modal - Meta Muse Spark Open" : run.modelId === "mock-deterministic" ? "Mock (offline)" : run.modelId)}</div>
<div><b>Provider</b><br/>${esc(run.modelId.includes("Muse") ? "Modal (dedicated endpoint)" : "Local mock")}</div>
<div><b>Status</b><br/>${esc(run.status)}</div>
<div><b>Duration</b><br/>${run.startedAt} → ${run.finishedAt || "n/a"}</div>
<div><b>Steps</b><br/>${run.steps.length}</div>
<div><b>Assertions</b><br/>${run.assertions.filter((a) => a.passed).length} passed / ${run.assertions.filter((a) => !a.passed).length} failed</div>
<div><b>Findings</b><br/>${run.findings.length}</div>
<div><b>Tokens</b><br/>prompt ${run.tokenUsage.promptTokens}, completion ${run.tokenUsage.completionTokens}, total ${run.tokenUsage.totalTokens}</div>
<div><b>Estimated cost (USD)</b><br/>${run.estimatedCostUsd.toFixed(4)}</div>
</div>
<h2>Scenarios</h2>${scenarioBlocks || "<p>None.</p>"}
<h2>Actions executed</h2>
<table><thead><tr><th>#</th><th>Action</th><th>Result</th><th>Evidence</th><th>Screenshot</th><th>Duration</th></tr></thead><tbody>${stepRows || "<tr><td colspan=6>None</td></tr>"}</tbody></table>
<h2>Assertions</h2>
<table><thead><tr><th>Description</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead><tbody>${assertionRows || "<tr><td colspan=4>None</td></tr>"}</tbody></table>
<h2>Findings</h2>${findingBlocks || "<p>No findings.</p>"}
<h2>Timeline</h2>
<ol>${run.timeline.map((t) => `<li><b>${esc(t.kind)}</b> ${esc(t.timestamp)} — ${esc(t.message)}</li>`).join("")}</ol>
</body></html>`;
}