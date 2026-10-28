import type { Observation, TestPlan, AgentDecision, TokenUsage } from "../schemas";

export interface ModelAdapter {
  readonly modelId: string;
  planTests(observation: Observation, objective: string, instructions?: string): Promise<{ plan: TestPlan; usage: TokenUsage }>;
  nextAction(input: {
    observation: Observation;
    plan: TestPlan;
    history: string;
    objective: string;
  }): Promise<{ decision: AgentDecision; usage: TokenUsage }>;
}

export interface AiConfig {
  modelId: string;
  endpointBaseUrl?: string;
  proxyToken?: string;
  workspace?: string;
}