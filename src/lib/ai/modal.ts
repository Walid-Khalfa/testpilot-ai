import type { ModelAdapter, AiConfig } from "./types";
import type { Observation, TestPlan, AgentDecision, TokenUsage } from "../schemas";
import { TestPlanSchema, AgentDecisionSchema } from "../schemas";
import { loadEnv } from "../schemas";

const DEFAULT_BASE = "https://inference.us-west.modal.direct/v1";
const MUSE_SPARK_MATCH = /muse[-_ ]?spark/i;

export function resolveModelProvider(): "mock" | "modal" {
  const forced = (process.env.MODEL_PROVIDER || "").toLowerCase();
  if (forced === "mock") return "mock";
  if (forced === "modal") return "modal";
  const e = loadEnv();
  return e.MODAL_PROXY_TOKEN ? "modal" : "mock";
}

async function listModalModels(cfg: AiConfig): Promise<string[]> {
  if (!cfg.proxyToken || !cfg.endpointBaseUrl) return [];
  const res = await fetch(`${cfg.endpointBaseUrl.replace(/\/$/, "")}/models`, {
    headers: { Authorization: `Bearer ${cfg.proxyToken}` },
  });
  if (!res.ok) throw new Error(`Modal /v1/models HTTP ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  return (data.data || []).map((m) => m.id).filter((x): x is string => typeof x === "string");
}

async function resolveModelId(cfg: AiConfig): Promise<string> {
  if (cfg.modelId && cfg.modelId.trim() && cfg.modelId !== "auto") return cfg.modelId;
  const ids = await listModalModels(cfg);
  const match = ids.find((id) => MUSE_SPARK_MATCH.test(id));
  if (match) return match;
  if (ids.length === 1) return ids[0];
  if (ids.length > 0) {
    throw new Error(`Could not identify Muse Spark Open model. Available: ${ids.join(", ")}`);
  }
  throw new Error("No models returned by Modal endpoint.");
}

function envConfig(): AiConfig {
  const e = loadEnv();
  return {
    modelId: e.MODAL_MODEL_ID || "auto",
    endpointBaseUrl: e.MODAL_ENDPOINT_BASE_URL || DEFAULT_BASE,
    proxyToken: e.MODAL_PROXY_TOKEN,
    workspace: e.MODAL_WORKSPACE,
  };
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // strip code fences
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  // find first { ... last }
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model response.");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function chat(cfg: AiConfig, messages: Array<{ role: string; content: string }>, timeoutMs = 120000, maxTokens = 2048): Promise<{ content: string; usage: TokenUsage }> {
  if (!cfg.proxyToken) throw new Error("MODAL_PROXY_TOKEN is not configured.");
  if (!cfg.endpointBaseUrl) throw new Error("MODAL_ENDPOINT_BASE_URL is not configured.");
  if (cfg.modelId === "auto") {
    cfg.modelId = await resolveModelId(cfg);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let attempt = 0;
  const maxAttempts = 3;
  let lastErr: unknown;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch(`${cfg.endpointBaseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.proxyToken}`,
        },
        body: JSON.stringify({
          model: cfg.modelId,
          messages,
          temperature: 0.2,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          reasoning_effort: "low",
          chat_template_kwargs: { enable_thinking: false },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Modal inference HTTP ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>; usage?: Record<string, number> };
      const msg = data?.choices?.[0]?.message;
      const content = (msg?.content && msg.content.trim()) ? msg.content : (msg?.reasoning_content || "");
      if (typeof content !== "string" || !content.trim()) throw new Error("Modal response missing content.");
      const u = data?.usage || {};
      const usage: TokenUsage = {
        promptTokens: Number(u.prompt_tokens || 0),
        completionTokens: Number(u.completion_tokens || 0),
        totalTokens: Number(u.total_tokens || (u.prompt_tokens || 0) + (u.completion_tokens || 0)),
      };
      clearTimeout(timer);
      return { content, usage };
    } catch (err) {
      lastErr = err;
      if (attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  clearTimeout(timer);
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function pingModal(cfg?: Partial<AiConfig>): Promise<{
  configured: boolean;
  ok: boolean;
  modelId?: string;
  latencyMs?: number;
  usage?: TokenUsage;
  error?: string;
}> {
  const base = envConfig();
  const merged: AiConfig = { ...base, ...cfg };
  if (!merged.proxyToken) {
    return { configured: false, ok: false, error: "MODAL_PROXY_TOKEN is not configured." };
  }
  const start = Date.now();
  try {
    const modelId = await resolveModelId(merged);
    merged.modelId = modelId;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const res = await fetch(`${merged.endpointBaseUrl!.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${merged.proxyToken}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: 'Reply with JSON: {"ok":true}' }],
        temperature: 0,
        max_tokens: 256,
        response_format: { type: "json_object" },
        reasoning_effort: "low",
        chat_template_kwargs: { enable_thinking: false },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text();
      return { configured: true, ok: false, modelId, latencyMs: Date.now() - start, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>; usage?: Record<string, number> };
    const msg = data?.choices?.[0]?.message;
    const raw = (msg?.content && msg.content.trim()) ? msg.content : (msg?.reasoning_content || "");
    let ok = false;
    try {
      const parsed = JSON.parse(raw);
      const val = Array.isArray(parsed) ? parsed[0] : parsed;
      ok = Boolean(val?.ok);
    } catch { ok = /"ok"\s*:\s*true/i.test(raw); }
    const u = data?.usage || {};
    const usage: TokenUsage = {
      promptTokens: Number(u.prompt_tokens || 0),
      completionTokens: Number(u.completion_tokens || 0),
      totalTokens: Number(u.total_tokens || (u.prompt_tokens || 0) + (u.completion_tokens || 0)),
    };
    return { configured: true, ok, modelId, latencyMs: Date.now() - start, usage };
  } catch (err) {
    return { configured: true, ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

export class ModalModelAdapter implements ModelAdapter {
  readonly modelId: string;
  private cfg: AiConfig;

  constructor(cfg?: Partial<AiConfig>) {
    const base = envConfig();
    this.cfg = { ...base, ...cfg };
    this.modelId = this.cfg.modelId;
  }

  async planTests(observation: Observation, objective: string, instructions?: string): Promise<{ plan: TestPlan; usage: TokenUsage }> {
    const messages = [
      {
        role: "system",
        content:
          "You are TestPilot AI. Return ONLY a JSON object matching: {\"scenarios\":[{id,title,objective,preconditions:[],steps:[{description,expected}],expectedResults:[],priority,risk,page,confidenceNotes}]}. No prose. expectedResults must be concrete observable strings present in the application UI.",
      },
      {
        role: "user",
        content: `Objective: ${objective}\nInstructions: ${instructions || "none"}\nObservation: ${JSON.stringify(observation).slice(0, 12000)}`,
      },
    ];
    const { content, usage } = await chat(this.cfg, messages, 120000, 4096);
    const parsed = extractJson(content) as Record<string, unknown>;
    if (parsed && Array.isArray(parsed.scenarios)) {
      const PRIORITIES = new Set(["low", "medium", "high", "critical"]);
      const RISKS = new Set(["low", "medium", "high"]);
      for (const s of parsed.scenarios as Array<Record<string, unknown>>) {
        if (typeof s.priority === "string") {
          const v = (s.priority as string).toLowerCase();
          s.priority = PRIORITIES.has(v) ? v : "medium";
        } else {
          s.priority = "medium";
        }
        if (typeof s.risk === "string") {
          const v = (s.risk as string).toLowerCase();
          s.risk = RISKS.has(v) ? v : "medium";
        } else {
          s.risk = "medium";
        }
      }
    }
    const plan = TestPlanSchema.parse(parsed);
    return { plan, usage };
  }

  async nextAction(input: {
    observation: Observation;
    plan: TestPlan;
    history: string;
    objective: string;
  }): Promise<{ decision: AgentDecision; usage: TokenUsage }> {
    const messages = [
      {
        role: "system",
        content:
          "You are TestPilot AI. Given observation and plan, choose ONE next action. Return ONLY JSON: {\"reasoning\":\"...\",\"action\":{\"type\":..., ...}}. Allowed types: navigate,click,fill,select,check,assert_text,assert_url,assert_visible,wait,screenshot,finish. For assert_text, the text MUST be copied verbatim from the observation (headings or page text) or the scenario expectedResults; never invent expected text.",
      },
      {
        role: "user",
        content: `Objective: ${input.objective}\nPlan: ${JSON.stringify(input.plan).slice(0, 8000)}\nHistory: ${input.history.slice(-4000)}\nObservation: ${JSON.stringify(input.observation).slice(0, 12000)}`,
      },
    ];
    let lastErr: unknown;
    const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for (let attempt = 0; attempt < 3; attempt++) {
      const attemptMessages = attempt === 0
        ? messages
        : [
            ...messages,
            { role: "assistant", content: "previous output was invalid" },
            { role: "user", content: `Your previous output failed validation: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}. Return corrected JSON only.` },
          ];
      const { content, usage } = await chat(this.cfg, attemptMessages, 120000, 2048);
      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;
      try {
        const parsed = extractJson(content) as Record<string, unknown>;
        // Normalize locator if missing for actions that need it
        const action = parsed?.action as Record<string, unknown> | undefined;
        if (action && typeof action.type === "string") {
          const needsLocator = ["click", "fill", "select", "check", "assert_visible"].includes(action.type);
          if (needsLocator && (!action.locator || typeof action.locator !== "object")) {
            const obs = input.observation;
            if (action.type === "fill" || action.type === "select") {
              const f = obs.formFields?.[0];
              if (f) action.locator = f.label ? { label: f.label } : { label: f.name };
            } else {
              // click/check/assert_visible: prefer a button-like interactive element
              const btn = obs.interactiveElements?.find((e) => e.role === "button") || obs.interactiveElements?.[0];
              if (btn?.locator) action.locator = btn.locator;
            }
          }
          if (action.type === "fill" && typeof action.value !== "string") {
            action.value = "Test value";
          }
        }
        const decision = AgentDecisionSchema.parse(parsed);
        return { decision, usage: totalUsage };
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

// Factory lives in ./index to avoid circular imports.