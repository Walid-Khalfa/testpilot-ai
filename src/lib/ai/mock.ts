import type { ModelAdapter } from "./types";
import type { Observation, TestPlan, AgentDecision, TokenUsage } from "../schemas";
import { TestPlanSchema, AgentDecisionSchema } from "../schemas";

function zeroUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export class MockModelAdapter implements ModelAdapter {
  readonly modelId = "mock-deterministic";

  async planTests(observation: Observation, objective: string): Promise<{ plan: TestPlan; usage: TokenUsage }> {
    const plan = TestPlanSchema.parse({
      scenarios: [
        {
          id: "scn-1",
          title: "Submit checkout form and verify confirmation",
          objective: objective || "Verify the checkout form submits and shows a confirmation.",
          preconditions: ["Application is reachable", "Form is visible"],
          steps: [
            { description: "Fill required form fields", expected: "Fields accept test input" },
            { description: "Click submit", expected: "Form submission is triggered" },
            { description: "Verify confirmation message", expected: "Confirmation message is displayed" },
          ],
          expectedResults: ["Confirmation message is displayed after submit"],
          priority: "high",
          risk: "medium",
          page: observation.url,
          confidenceNotes: "Mock adapter: deterministic plan for offline/demo use.",
        },
      ],
    });
    return { plan, usage: zeroUsage() };
  }

  async nextAction(input: {
    observation: Observation;
    plan: TestPlan;
    history: string;
    objective: string;
  }): Promise<{ decision: AgentDecision; usage: TokenUsage }> {
    const { observation, history } = input;
    const fillCount = (history.match(/"type":"fill"/g) || []).length;
    const clicked = /"type":"click"/.test(history);
    const asserted = /"type":"assert_text"/.test(history);

    const formFields = observation.formFields || [];
    const submitBtn = observation.interactiveElements.find((e) =>
      /submit|order|checkout|buy|place/i.test(e.name),
    );

    let action: AgentDecision["action"];
    if (fillCount < formFields.length && formFields.length > 0) {
      const field = formFields[fillCount];
      const value =
        field.type === "email"
          ? "test@example.com"
          : field.type === "tel"
            ? "5550100"
            : `Test value ${fillCount + 1}`;
      action = { type: "fill", locator: fieldLabelLocator(field), value };
    } else if (!clicked && submitBtn) {
      action = { type: "click", locator: submitBtn.locator };
    } else if (clicked && !asserted) {
      action = { type: "assert_text", text: "Order confirmed" };
    } else if (asserted) {
      action = { type: "finish", summary: "Completed checkout scenario; assertion result recorded." };
    } else {
      // fallback: try submit then finish
      if (submitBtn) action = { type: "click", locator: submitBtn.locator };
      else action = { type: "finish", summary: "No submit button found; finishing." };
    }

    const decision = AgentDecisionSchema.parse({
      reasoning: "Mock adapter deterministic decision.",
      action,
    });
    return { decision, usage: zeroUsage() };
  }
}

function fieldLabelLocator(field: { label?: string; name: string }) {
  if (field.label) return { label: field.label };
  return { label: field.name };
}