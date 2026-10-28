import type { Run, Project, TimelineEvent, AssertionResult, Finding, ActionResult } from "../schemas";
import { runRepo } from "../storage/file-store";
import { createModelAdapter } from "../ai";
import { BrowserExecutor } from "../browser/executor";
import type { AgentAction } from "../schemas";

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
    await runRepo.save(run);
    if (!navResult.ok) {
      pushEvent(run, cb, "error", `Initial navigation failed: ${navResult.evidence}`);
    }

    // Plan tests
    pushEvent(run, cb, "observe", "Observing initial page state.");
    let observation = await executor.observe();
    pushEvent(run, cb, "plan", "Requesting test plan from model.");
    const { plan, usage: planUsage } = await adapter.planTests(observation, project.objective, project.instructions);
    run.scenarios = plan.scenarios;
    run.tokenUsage.promptTokens += planUsage.promptTokens;
    run.tokenUsage.completionTokens += planUsage.completionTokens;
    run.tokenUsage.totalTokens += planUsage.totalTokens;
    pushEvent(run, cb, "plan", `Generated ${plan.scenarios.length} scenario(s).`, { scenarios: plan.scenarios.map((s) => s.title) });
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
      try {
        const res = await adapter.nextAction({
          observation,
          plan,
          history: history.join("\n"),
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
      pushEvent(run, cb, "reason", `Model chose: ${action.type}`, { reasoning: decision.reasoning, action });

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
        if (!assertion.passed && assertion.expected.trim() !== "" && !run.findings.some((f) => f.title === `Assertion failed: ${assertion.description}`)) {
          // create finding
          // Grounding check: is the expected text present in the page DOM (even if hidden)
          // OR referenced by the project objective / scenario expected results?
          // If yes, the expectation is grounded -> confirmed defect. If not, it may be
          // LLM-invented -> keep as suspected.
          let grounded = false;
          try {
            const html = await executor.getPage().content();
            const exp = assertion.expected.toLowerCase();
            // Only the page DOM (including hidden elements) can confirm a defect.
            // Objective/scenario text is LLM/user-authored and must not alone confirm.
            grounded = html.toLowerCase().includes(exp);
          } catch { grounded = false; }
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
              ...run.steps.slice(-5).map((s) => `${s.action.type}: ${s.evidence}`),
            ],
            scenarioId: run.scenarios[0]?.id,
          };
          run.findings.push(finding);
          pushEvent(run, cb, "adapt", "Suspected defect recorded with evidence.", { finding });
        }
      } else {
        pushEvent(run, cb, "verify", result.ok ? `Action succeeded: ${action.type}` : `Action failed: ${action.type}`, { result });
      }

      // Console errors as suspected findings (once)
      // (handled lightly: add if new errors and no finding yet)
      stepCount++;
      await runRepo.save(run);

      if (action.type === "finish") {
        finished = true;
        pushEvent(run, cb, "report", "Agent finished execution.");
      }
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