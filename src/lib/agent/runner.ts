import type { Run, Project, TimelineEvent, AssertionResult, Finding, ActionResult } from "../schemas";
import { runRepo, requirementDocRepo } from "../storage/file-store";
import { createModelAdapter } from "../ai";
import { retrieveRequirements } from "../rag/retrieve";
import { BrowserExecutor } from "../browser/executor";
import type { AgentAction, RequirementCoverage } from "../schemas";
import { RequirementCoverageSchema } from "../schemas";

function deriveRequirements(project: Project): RequirementCoverage[] {
  const out: RequirementCoverage[] = [];
  const seen = new Set<string>();
  const sources: Array<{ text: string; source: "objective" | "instructions" }> = [
    { text: project.objective, source: "objective" },
  ];
  if (project.instructions) sources.push({ text: project.instructions, source: "instructions" });
  for (const { text, source } of sources) {
    // Extract quoted strings (single or double quotes) as explicit expected outcomes.
    const matches = text.match(/["']([^"']{2,80})["']/g) || [];
    for (const m of matches) {
      const val = m.slice(1, -1).trim();
      if (!val) continue;
      const key = val.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(RequirementCoverageSchema.parse({
        id: crypto.randomUUID(),
        text: val,
        source,
        status: "not_tested",
      }));
    }
  }
  return out;
}

export interface RunCallbacks {
  onEvent?: (e: TimelineEvent) => void;
  isCancelled?: () => boolean;
}

function pushEvent(run: Run, cb: RunCallbacks, kind: TimelineEvent["kind"], message: string, data?: unknown): void {
  const ev: TimelineEvent = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    kind,
    message,
    data,
  };
  run.timeline.push(ev);
  cb.onEvent?.(ev);
}

function actionToAssertion(action: AgentAction, result: ActionResult): AssertionResult | null {
  if (action.type === "assert_text") {
    return {
      id: crypto.randomUUID(),
      description: `Assert text "${action.text}" is present`,
      expected: action.text,
      actual: result.ok ? "found" : "not found",
      passed: result.ok,
      evidenceRef: result.screenshotPath,
      timestamp: result.timestamp,
    };
  }
  if (action.type === "assert_url") {
    return {
      id: crypto.randomUUID(),
      description: `Assert URL contains "${action.url}"`,
      expected: action.url,
      actual: result.evidence,
      passed: result.ok,
      timestamp: result.timestamp,
    };
  }
  if (action.type === "assert_visible") {
    return {
      id: crypto.randomUUID(),
      description: `Assert element visible`,
      expected: "visible",
      actual: result.ok ? "visible" : "not visible",
      passed: result.ok,
      timestamp: result.timestamp,
    };
  }
  return null;
}

export async function executeRun(run: Run, project: Project, cb: RunCallbacks = {}): Promise<Run> {
  const adapter = createModelAdapter();
  run.modelId = adapter.modelId;
  run.status = "running";
  run.requirements = deriveRequirements(project);
  await runRepo.save(run);

  const executor = new BrowserExecutor({
    allowedDomain: project.authorizedDomain,
    maxPages: project.maxPages,
    localDemo: process.env.ALLOW_LOCAL_DEMO === "true",
  });

  const started = Date.now();
  let cancelled = false;

  try {
    await executor.start();
    executor.attachListeners();
    pushEvent(run, cb, "info", `Browser started. Model: ${adapter.modelId}`);

    // Initial navigation
    pushEvent(run, cb, "act", `Navigating to ${project.targetUrl}`);
    const navResult = await executor.execute({ type: "navigate", url: project.targetUrl });
    run.steps.push(navResult);
    run.pagesVisited = executor.getPagesVisited();
    await runRepo.save(run);
    if (!navResult.ok) {
      pushEvent(run, cb, "error", `Initial navigation failed: ${navResult.evidence}`);
      run.status = "failed";
      run.error = `Initial navigation failed: ${navResult.evidence}`;
      await executor.stop();
      run.finishedAt = new Date().toISOString();
      run.estimatedCostUsd =
        run.tokenUsage.promptTokens * (1.25 / 1_000_000) +
        run.tokenUsage.completionTokens * (4.25 / 1_000_000);
      await runRepo.save(run);
      return run;
    }

    // Plan tests
    pushEvent(run, cb, "observe", "Observing initial page state.");
    let observation = await executor.observe();
    pushEvent(run, cb, "plan", "Requesting test plan from model.");
    const { plan, usage: planUsage } = await adapter.planTests(observation, project.objective, project.instructions);
    run.scenarios = plan.scenarios;
    // Retrieve requirements from uploaded specifications (RAG, deterministic).
    try {
      const docs = await requirementDocRepo.list(project.id);
      const candidates = docs.flatMap((d) => d.requirements.map((r) => ({ id: r.id, text: r.text, documentId: d.id, section: r.section })));
      const retrieved = retrieveRequirements(project.objective + " " + (project.instructions || ""), candidates, 3);
      const existing = new Set(run.requirements.map((r) => r.text.toLowerCase()));
      for (const r of retrieved) {
        if (existing.has(r.text.toLowerCase())) continue;
        existing.add(r.text.toLowerCase());
        run.requirements.push(r);
      }
      if (retrieved.length > 0) {
        pushEvent(run, cb, "plan", `Retrieved ${retrieved.length} requirement(s) from uploaded specifications.`, { retrieved: retrieved.map((r) => ({ id: r.id, score: r.score, source: r.documentId })) });
      }
    } catch (err) {
      pushEvent(run, cb, "info", `Requirement retrieval skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
    run.tokenUsage.promptTokens += planUsage.promptTokens;
    run.tokenUsage.completionTokens += planUsage.completionTokens;
    run.tokenUsage.totalTokens += planUsage.totalTokens;
    pushEvent(run, cb, "plan", `Generated ${plan.scenarios.length} scenario(s).`, { scenarios: plan.scenarios.map((s) => s.title) });
    if (run.requirements.length > 0) {
      pushEvent(run, cb, "plan", `Tracking ${run.requirements.length} explicit requirement(s): ${run.requirements.map((r) => r.text).join(", ")}`);
    }
    await runRepo.save(run);

    const history: string[] = [];
    let stepCount = 0;
    let finished = false;

    while (!finished) {
      if (cb.isCancelled?.()) { cancelled = true; break; }
      if (Date.now() - started > project.maxDurationSec * 1000) {
        pushEvent(run, cb, "info", "Max duration reached; stopping.");
        break;
      }
      if (stepCount >= project.maxSteps) {
        pushEvent(run, cb, "info", "Max steps reached; stopping.");
        break;
      }
      if (run.tokenUsage.totalTokens > project.maxTokens) {
        pushEvent(run, cb, "info", "Token budget exceeded; stopping.");
        break;
      }

      // Observe
      pushEvent(run, cb, "observe", "Observing current page.");
      observation = await executor.observe();

      // Reason
      pushEvent(run, cb, "reason", "Asking model for next action.");
      let decision;
      let usage;
      const outstanding = run.requirements.filter((r) => r.status === "not_tested" || r.status === "in_progress");
      const historyWithReqs = outstanding.length > 0
        ? `${history.join("\n")}\nOutstanding requirements (must be tested before finishing): ${outstanding.map((r) => r.text).join(", ")}`
        : `${history.join("\n")}\nAll explicit requirements have been evaluated.`;
      try {
        const res = await adapter.nextAction({
          observation,
          plan,
          history: historyWithReqs,
          objective: project.objective,
        });
        decision = res.decision;
        usage = res.usage;
      } catch (err) {
        pushEvent(run, cb, "error", `Model call failed: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
      run.tokenUsage.promptTokens += usage.promptTokens;
      run.tokenUsage.completionTokens += usage.completionTokens;
      run.tokenUsage.totalTokens += usage.totalTokens;

      const action = decision.action as AgentAction;
      pushEvent(run, cb, "reason", `Model chose: ${action.type}`, {
        reasoning: decision.reasoning,
        visualObservation: decision.visualObservation,
        visionMode: decision.visionMode,
        action,
      });

      // Policy validation: re-validate navigate URLs; block dangerous actions by type (already typed, no JS).
      if (action.type === "navigate") {
        const check = (await import("../security/url-safety")).validateNavigationUrl(action.url, project.authorizedDomain);
        if (!check.ok) {
          pushEvent(run, cb, "error", `Blocked navigation: ${check.reason}`);
          // record as failed step
          const failResult: ActionResult = {
            action,
            ok: false,
            evidence: check.reason,
            error: check.reason,
            durationMs: 0,
            timestamp: new Date().toISOString(),
          };
          run.steps.push(failResult);
          history.push(JSON.stringify({ action, result: "blocked" }));
          stepCount++;
          await runRepo.save(run);
          continue;
        }
      }

      // Execute
      pushEvent(run, cb, "act", `Executing ${action.type}.`);
      const result = await executor.execute(action);
      run.steps.push(result);
      history.push(JSON.stringify({ action, result: result.ok ? "ok" : "fail", evidence: result.evidence }));

      // Assertions
      const assertion = actionToAssertion(action, result);
      if (assertion) {
        run.assertions.push(assertion);
        pushEvent(run, cb, "verify", assertion.passed ? `Assertion passed: ${assertion.description}` : `Assertion FAILED: ${assertion.description}`, { assertion });
        // Update requirement coverage for assert_text matching an explicit requirement.
        if (action.type === "assert_text") {
          const req = run.requirements.find((r) => r.text.toLowerCase() === action.text.toLowerCase());
          if (req) {
            req.status = assertion.passed ? "passed" : "failed";
            req.evidence = assertion.evidenceRef;
            pushEvent(run, cb, "verify", `Requirement "${req.text}" ${req.status}.`, { requirement: req });
          }
        }
        if (!assertion.passed && assertion.expected.trim() !== "" && !run.findings.some((f) => f.title === `Assertion failed: ${assertion.description}`)) {
          // create finding
          // Grounding check: an expectation is "grounded" only when it is explicitly
          // declared in the project objective, testing instructions, or a scenario's
          // expectedResults. Raw DOM presence (including hidden elements) is NOT used,
          // so hidden text cannot by itself confirm a defect.
          const exp = assertion.expected.toLowerCase().trim();
          // Only user-authored expectations (objective/instructions) are trustworthy
          // oracles. LLM-generated scenario expectations must not independently
          // confirm a defect.
          const grounded =
            exp.length > 0 && (
              project.objective.toLowerCase().includes(exp) ||
              (project.instructions || "").toLowerCase().includes(exp)
            );
          const finding: Finding = {
            id: crypto.randomUUID(),
            type: "failed_assertion",
            title: `Assertion failed: ${assertion.description}`,
            severity: "high",
            status: grounded ? "confirmed" : "suspected",
            description: `Assertion failed during execution: ${assertion.description}`,
            expected: assertion.expected,
            actual: assertion.actual,
            evidenceRefs: result.screenshotPath ? [result.screenshotPath] : [],
            reproSteps: [
              `Navigate to ${project.targetUrl}`,
              ...run.steps.slice(-5).map((s) => {
                const a = s.action;
                const target =
                  a.type === "navigate" ? a.url :
                  a.type === "fill" || a.type === "click" || a.type === "select" || a.type === "check" || a.type === "assert_text" || a.type === "assert_visible"
                    ? JSON.stringify(a.locator || {})
                    : "";
                const detail =
                  a.type === "fill" ? " (input value redacted)" :
                  a.type === "navigate" ? "" :
                  ` (${s.evidence})`;
                return `${a.type}${target ? " on " + target : ""}${detail}`;
              }),
            ],
            scenarioId: run.scenarios[0]?.id,
          };
          run.findings.push(finding);
          pushEvent(run, cb, "adapt", `${finding.status === "confirmed" ? "Confirmed" : "Suspected"} defect recorded with evidence.`, { finding });
        }
      } else {
        pushEvent(run, cb, "verify", result.ok ? `Action succeeded: ${action.type}` : `Action failed: ${action.type}`, { result });
      }

      // Console errors as suspected findings (once)
      // (handled lightly: add if new errors and no finding yet)
      run.pagesVisited = executor.getPagesVisited();
      stepCount++;
      await runRepo.save(run);

      if (action.type === "finish") {
        const uncovered = run.requirements.filter((r) => r.status === "not_tested" || r.status === "in_progress");
        if (uncovered.length > 0 && stepCount < project.maxSteps - 1) {
          pushEvent(run, cb, "adapt", `Finish deferred: ${uncovered.length} requirement(s) still untested: ${uncovered.map((r) => r.text).join(", ")}`);
          history.push(`Do not finish yet. Untested requirements: ${uncovered.map((r) => r.text).join(", ")}`);
          stepCount++;
          await runRepo.save(run);
          continue;
        }
        finished = true;
        pushEvent(run, cb, "report", "Agent finished execution.");
      }
    }

    for (const r of run.requirements) {
      if (r.status === "not_tested" || r.status === "in_progress") r.status = "blocked";
    }
    if (cancelled) {
      run.status = "cancelled";
      pushEvent(run, cb, "info", "Run cancelled by user.");
    } else if (run.status === "running") {
      run.status = "completed";
    }
  } catch (err) {
    run.status = "failed";
    run.error = err instanceof Error ? err.message : String(err);
    pushEvent(run, cb, "error", `Run failed: ${run.error}`);
  } finally {
    await executor.stop();
    run.finishedAt = new Date().toISOString();
    // cost estimate
    run.estimatedCostUsd =
      run.tokenUsage.promptTokens * (1.25 / 1_000_000) +
      run.tokenUsage.completionTokens * (4.25 / 1_000_000);
    await runRepo.save(run);
  }

  return run;
}