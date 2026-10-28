import { loadEnv } from "../schemas";
import type { ModelAdapter } from "./types";
import { ModalModelAdapter, resolveModelProvider } from "./modal";
import { MockModelAdapter } from "./mock";

export function createModelAdapter(): ModelAdapter {
  const provider = resolveModelProvider();
  if (provider === "modal") {
    const e = loadEnv();
    if (!e.MODAL_PROXY_TOKEN) {
      throw new Error("MODEL_PROVIDER=modal but MODAL_PROXY_TOKEN is not configured.");
    }
    return new ModalModelAdapter();
  }
  return new MockModelAdapter();
}

export function isLiveConfigured(): boolean {
  return resolveModelProvider() === "modal";
}

export function providerLabel(modelId: string): string {
  if (/muse/i.test(modelId)) return "Modal — Meta Muse Spark Open";
  if (modelId === "mock-deterministic") return "Mock (offline)";
  return modelId;
}

export { pingModal } from "./modal";
export type { ModelAdapter } from "./types";
export { ModalModelAdapter } from "./modal";
export { MockModelAdapter } from "./mock";