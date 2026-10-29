import fs from "node:fs";
import path from "node:path";
import type { ModelAdapter, AiConfig } from "./types";
import type { Observation, TestPlan, AgentDecision, TokenUsage } from "../schemas";
import { TestPlanSchema, AgentDecisionSchema } from "../schemas";
import { loadEnv } from "../schemas";

const DEFAULT_BASE = "https://inference.us-west.modal.direct/v1";
const MUSE_SPARK_MATCH = /muse[-_ ]?spark/i;
const MAX_IMAGE_BYTES = 250_000;

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: string;
  content: string | ChatContentPart[];
};

export function loadScreenshotDataUrl(screenshotPath?: string): string | null {
  if (!screenshotPath) return null;
  if ((process.env.ENABLE_MULTIMODAL_VISION || "").toLowerCase() === "false") return null;
  try {
    const rel = screenshotPath.replace(/^\.data\//, "");
    if (!/^screenshots\/[A-Za-z0-9_.-]+\.png$/.test(rel)) return null;
    const baseDir = loadEnv().DATA_DIR || ".data";
    const file = path.resolve(process.cwd(), baseDir, rel);
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_IMAGE_BYTES) return null;
    const buf = fs.readFileSync(file);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export function shouldAttachScreenshot(history: string): boolean {
  const stepLines = history
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("{"));
  if (stepLines.length === 0) return true;
  try {
    const last = JSON.parse(stepLines[stepLines.length - 1]) as {
      action?: { type?: string };
      result?: string;
    };
    const actionType = last.action?.type || "";
    if (["click", "navigate", "wait", "screenshot"].includes(actionType)) return true;
    if (last.result === "fail") return true;
    return false;
  } catch {
    return false;
  }
}

export function buildUserContent(textPrompt: string, dataUrl: string | null): string | ChatContentPart[] {
  if (!dataUrl) return textPrompt;
  return [
    { type: "text", text: textPrompt },
    { type: "image_url", image_url: { url: dataUrl } },
  ];
}

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

async function chat(cfg: AiConfig, messages: ChatMessage[], timeoutMs = 120000, maxTokens = 2048, maxAttempts = 3): Promise<{ content: string; usage: TokenUsage }> {
  if (!cfg.proxyToken) throw new Error("MODAL_PROXY_TOKEN is not configured.");
  if (!cfg.endpointBaseUrl) throw new Error("MODAL_ENDPOINT_BASE_URL is not configured.");
  if (cfg.modelId === "auto") {
    cfg.modelId = await resolveModelId(cfg);
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let attempt = 0;
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
    const systemMsg = {
      role: "system",
      content:
        "You are TestPilot AI. Return ONLY a JSON object matching: {\"scenarios\":[{id,title,objective,preconditions:[],steps:[{description,expected}],expectedResults:[],priority,risk,page,confidenceNotes}]}. No prose. expectedResults must be concrete observable strings expected to be visible in the UI when the scenario succeeds (including explicit user-specified requirements from the objective or instructions).",
    };
    const userText = `Objective: ${objective}\nInstructions: ${instructions || "none"}\nObservation: ${JSON.stringify(observation).slice(0, 12000)}`;
    const dataUrl = loadScreenshotDataUrl(observation.screenshotPath);
    const messages: ChatMessage[] = [
      systemMsg,
      { role: "user", content: buildUserContent(userText, dataUrl) },
    ];
    let content: string;
    let usage: TokenUsage;
    if (dataUrl) {
      try {
        const res = await chat(this.cfg, messages, 120000, 4096, 1);
        content = res.content;
        usage = res.usage;
      } catch {
        const res = await chat(this.cfg, [systemMsg, { role: "user", content: userText }], 120000, 4096);
        content = res.content;
        usage = res.usage;
      }
    } else {
      const res = await chat(this.cfg, messages, 120000, 4096);
      content = res.content;
      usage = res.usage;
    }
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
    const attachImage = shouldAttachScreenshot(input.history);
    const dataUrl = attachImage ? loadScreenshotDataUrl(input.observation.screenshotPath) : null;
    const systemMsg = {
      role: "system",
      content:
        "You are TestPilot AI. Given observation and plan, choose ONE next action. Return ONLY JSON: {\"reasoning\":\"...\",\"visualObservation\":\"...\",\"action\":{\"type\":..., ...}}. When a screenshot image is provided, populate visualObservation with a brief, factual description of the visible UI state (e.g. filled inputs, buttons, or confirmation banners); otherwise omit visualObservation. Allowed types: navigate,click,fill,select,check,assert_text,assert_url,assert_visible,wait,screenshot,finish. For assert_text, text should be an explicit expected string from the objective/instructions, outstanding requirements, scenario expectedResults, or current observation; never invent arbitrary ungrounded text.",
    };
    const userText = `Objective: ${input.objective}\nPlan: ${JSON.stringify(input.plan).slice(0, 8000)}\nHistory: ${input.history.slice(-4000)}\nObservation: ${JSON.stringify(input.observation).slice(0, 12000)}`;
    let useMultimodal = Boolean(dataUrl);
    let usedFallback = false;
    let lastErr: unknown;
    const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    for (let attempt = 0; attempt < 3; attempt++) {
      const baseMessages: ChatMessage[] = [
        systemMsg,
        { role: "user", content: buildUserContent(userText, useMultimodal ? dataUrl : null) },
      ];
      const attemptMessages: ChatMessage[] = attempt === 0
        ? baseMessages
        : [
            ...baseMessages,
            { role: "assistant", content: "previous output was invalid" },
            { role: "user", content: `Your previous output failed validation: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}. Return corrected JSON only.` },
          ];
      let content: string;
      let usage: TokenUsage;
      try {
        const res = await chat(this.cfg, attemptMessages, 120000, 2048, useMultimodal ? 1 : 3);
        content = res.content;
        usage = res.usage;
      } catch (chatErr) {
        if (useMultimodal) {
          useMultimodal = false;
          usedFallback = true;
          const fallbackMsgs: ChatMessage[] = [
            systemMsg,
            { role: "user", content: userText },
          ];
          const res = await chat(this.cfg, fallbackMsgs, 120000, 2048);
          content = res.content;
          usage = res.usage;
        } else {
          throw chatErr;
        }
      }
      totalUsage.promptTokens += usage.promptTokens;
      totalUsage.completionTokens += usage.completionTokens;
      totalUsage.totalTokens += usage.totalTokens;
      try {
        const parsed = extractJson(content) as Record<string, unknown>;
        parsed.visionMode = useMultimodal
          ? "multimodal"
          : usedFallback
            ? "text_fallback"
            : "text_only";
        if (typeof parsed.visualObservation !== "string" || !parsed.visualObservation.trim()) {
          delete parsed.visualObservation;
        }
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
        if (useMultimodal) {
          useMultimodal = false;
          usedFallback = true;
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  }
}

// Factory lives in ./index to avoid circular imports.