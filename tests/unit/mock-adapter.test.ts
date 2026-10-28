import { describe, it, expect } from "vitest";
import { MockModelAdapter } from "@/lib/ai/mock";
import type { Observation } from "@/lib/schemas";

const obs: Observation = {
  url: "http://localhost:3000/demo-shop/",
  title: "Demo Shop",
  headings: ["Demo Shop — Checkout"],
  interactiveElements: [{ role: "button", name: "Place order", locator: { role: "button", name: "Place order" } }],
  formFields: [
    { name: "name", type: "text", label: "Full name", required: true },
    { name: "email", type: "email", label: "Email", required: true },
  ],
  consoleErrors: [],
  networkErrors: [],
  capturedAt: new Date().toISOString(),
};

describe("MockModelAdapter", () => {
  it("produces a valid plan", async () => {
    const m = new MockModelAdapter();
    const { plan } = await m.planTests(obs, "test checkout");
    expect(plan.scenarios.length).toBeGreaterThan(0);
  });
  it("sequences actions", async () => {
    const m = new MockModelAdapter();
    const { plan } = await m.planTests(obs, "test checkout");
    const d1 = await m.nextAction({ observation: obs, plan, history: "", objective: "test" });
    expect(d1.decision.action.type).toBe("fill");
    const d2 = await m.nextAction({ observation: obs, plan, history: JSON.stringify({ type: "fill" }), objective: "test" });
    expect(["fill", "click", "assert_text"]).toContain(d2.decision.action.type);
  });
});