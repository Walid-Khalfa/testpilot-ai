import { z } from "zod";

// ---------- Project ----------

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  targetUrl: z.string().url(),
  authorizedDomain: z.string().min(1),
  objective: z.string().min(1).max(500),
  maxDurationSec: z.number().int().min(10).max(600),
  maxSteps: z.number().int().min(1).max(200),
  maxPages: z.number().int().min(1).max(100),
  maxTokens: z.number().int().min(1000).max(200000),
  instructions: z.string().max(2000).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectInputSchema = ProjectSchema.pick({
  name: true,
  targetUrl: true,
  authorizedDomain: true,
  objective: true,
  maxDurationSec: true,
  maxSteps: true,
  maxPages: true,
  maxTokens: true,
  instructions: true,
}).extend({
  confirmAuthorization: z.literal(true),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

// ---------- Locator (accessibility-based only) ----------

export const LocatorSchema = z.object({
  role: z.string().optional(),
  name: z.string().optional(),
  text: z.string().optional(),
  testId: z.string().optional(),
  label: z.string().optional(),
}).refine((v) => v.role || v.text || v.testId || v.label || v.name, {
  message: "Locator must specify at least one of role/name/text/testId/label",
});
export type Locator = z.infer<typeof LocatorSchema>;

// ---------- Observation ----------

export const InteractiveElementSchema = z.object({
  role: z.string(),
  name: z.string(),
  locator: LocatorSchema,
  disabled: z.boolean().optional(),
});
export type InteractiveElement = z.infer<typeof InteractiveElementSchema>;

export const FormFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  label: z.string().optional(),
  required: z.boolean().optional(),
  value: z.string().optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

export const ObservationSchema = z.object({
  url: z.string().url(),
  title: z.string(),
  headings: z.array(z.string()).max(50),
  visibleText: z.array(z.string()).max(80).optional(),
  interactiveElements: z.array(InteractiveElementSchema).max(100),
  formFields: z.array(FormFieldSchema).max(50),
  consoleErrors: z.array(z.string()).max(50),
  networkErrors: z.array(z.string()).max(50),
  screenshotPath: z.string().optional(),
  capturedAt: z.string().datetime(),
});
export type Observation = z.infer<typeof ObservationSchema>;

// ---------- Agent actions (LLM proposals) ----------

const NavigateAction = z.object({ type: z.literal("navigate"), url: z.string().url() });
const ClickAction = z.object({ type: z.literal("click"), locator: LocatorSchema });
const FillAction = z.object({ type: z.literal("fill"), locator: LocatorSchema, value: z.string().max(500) });
const SelectAction = z.object({ type: z.literal("select"), locator: LocatorSchema, value: z.string().max(200) });
const CheckAction = z.object({ type: z.literal("check"), locator: LocatorSchema });
const AssertTextAction = z.object({ type: z.literal("assert_text"), locator: LocatorSchema.optional(), text: z.string().max(500) });
const AssertUrlAction = z.object({ type: z.literal("assert_url"), url: z.string() });
const AssertVisibleAction = z.object({ type: z.literal("assert_visible"), locator: LocatorSchema });
const WaitAction = z.object({ type: z.literal("wait"), ms: z.number().int().min(0).max(5000) });
const ScreenshotAction = z.object({ type: z.literal("screenshot"), label: z.string().max(80).optional() });
const FinishAction = z.object({ type: z.literal("finish"), summary: z.string().max(1000) });

export const AgentActionSchema = z.discriminatedUnion("type", [
  NavigateAction,
  ClickAction,
  FillAction,
  SelectAction,
  CheckAction,
  AssertTextAction,
  AssertUrlAction,
  AssertVisibleAction,
  WaitAction,
  ScreenshotAction,
  FinishAction,
]);
export type AgentAction = z.infer<typeof AgentActionSchema>;

export const AgentDecisionSchema = z.object({
  reasoning: z.string().max(1000),
  visualObservation: z.string().max(500).optional(),
  visionMode: z.enum(["multimodal", "text_fallback", "text_only"]).optional(),
  action: AgentActionSchema,
});
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;

// ---------- Test scenario ----------

export const TestStepSchema = z.object({
  description: z.string(),
  action: AgentActionSchema.optional(),
  expected: z.string(),
});
export type TestStep = z.infer<typeof TestStepSchema>;

export const TestScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  preconditions: z.array(z.string()).default([]),
  steps: z.array(TestStepSchema).min(1),
  expectedResults: z.array(z.string()).min(1),
  priority: z.enum(["low", "medium", "high", "critical"]),
  risk: z.enum(["low", "medium", "high"]),
  page: z.string(),
  confidenceNotes: z.string().optional(),
});
export type TestScenario = z.infer<typeof TestScenarioSchema>;

export const TestPlanSchema = z.object({
  scenarios: z.array(TestScenarioSchema).min(1).max(20),
});
export type TestPlan = z.infer<typeof TestPlanSchema>;

// ---------- Assertions & findings ----------

export const AssertionResultSchema = z.object({
  id: z.string(),
  description: z.string(),
  expected: z.string(),
  actual: z.string(),
  passed: z.boolean(),
  evidenceRef: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type AssertionResult = z.infer<typeof AssertionResultSchema>;

export const FindingSeveritySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const FindingStatusSchema = z.enum(["suspected", "confirmed", "rejected"]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  severity: FindingSeveritySchema,
  status: FindingStatusSchema,
  description: z.string(),
  expected: z.string(),
  actual: z.string(),
  evidenceRefs: z.array(z.string()).default([]),
  reproSteps: z.array(z.string()).default([]),
  scenarioId: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

// ---------- Timeline ----------

export const TimelineEventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime(),
  kind: z.enum(["observe", "plan", "reason", "act", "verify", "adapt", "report", "error", "info"]),
  message: z.string(),
  data: z.unknown().optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ---------- Run ----------

export const RequirementStatusSchema = z.enum([
  "not_tested",
  "in_progress",
  "passed",
  "failed",
  "blocked",
]);
export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;

export const RequirementCoverageSchema = z.object({
  id: z.string(),
  text: z.string(),
  source: z.enum(["objective", "instructions"]),
  status: RequirementStatusSchema,
  evidence: z.string().optional(),
});
export type RequirementCoverage = z.infer<typeof RequirementCoverageSchema>;

export const RunStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const TokenUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;

export const ActionResultSchema = z.object({
  action: AgentActionSchema,
  ok: z.boolean(),
  evidence: z.string(),
  error: z.string().optional(),
  durationMs: z.number().int().nonnegative(),
  screenshotPath: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

export const RunSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: RunStatusSchema,
  modelId: z.string(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  maxSteps: z.number().int(),
  maxDurationSec: z.number().int(),
  maxPages: z.number().int(),
  maxTokens: z.number().int(),
  pagesVisited: z.number().int().nonnegative().default(0),
  steps: z.array(ActionResultSchema).default([]),
  assertions: z.array(AssertionResultSchema).default([]),
  findings: z.array(FindingSchema).default([]),
  scenarios: z.array(TestScenarioSchema).default([]),
  requirements: z.array(RequirementCoverageSchema).default([]),
  tokenUsage: TokenUsageSchema.default({ promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
  estimatedCostUsd: z.number().nonnegative().default(0),
  timeline: z.array(TimelineEventSchema).default([]),
  reportPath: z.string().optional(),
  error: z.string().optional(),
  cancelled: z.boolean().default(false),
});
export type Run = z.infer<typeof RunSchema>;

// ---------- Env ----------

export const EnvSchema = z.object({
  MODAL_ENDPOINT_BASE_URL: z.string().url().optional(),
  MODAL_MODEL_ID: z.string().optional(),
  MODAL_PROXY_TOKEN: z.string().optional(),
  MODAL_WORKSPACE: z.string().optional(),
  ALLOW_LOCAL_DEMO: z.string().optional(),
  MAX_CONCURRENT_RUNS: z.string().optional(),
  DATA_DIR: z.string().optional(),
});
export type AppEnv = z.infer<typeof EnvSchema>;

export function loadEnv(): AppEnv {
  return EnvSchema.parse({
    MODAL_ENDPOINT_BASE_URL: process.env.MODAL_ENDPOINT_BASE_URL,
    MODAL_MODEL_ID: process.env.MODAL_MODEL_ID,
    MODAL_PROXY_TOKEN: process.env.MODAL_PROXY_TOKEN,
    MODAL_WORKSPACE: process.env.MODAL_WORKSPACE,
    ALLOW_LOCAL_DEMO: process.env.ALLOW_LOCAL_DEMO,
    MAX_CONCURRENT_RUNS: process.env.MAX_CONCURRENT_RUNS,
    DATA_DIR: process.env.DATA_DIR,
  });
}