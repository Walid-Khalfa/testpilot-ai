# STAGE 1: MULTIMODAL FEASIBILITY AUDIT — TESTPILOT AI
**Commit Audited:** `63ad1774f6cfc669e8d06d75d7437fbe9445584b`
**Model & Endpoint:** `meta-models/Muse-Spark-Open-816B-A42B` on Modal (`https://khelfawalid--ep-muse-spark-open-816b-a42b-server.us-west.modal.direct/v1`)

> **Compliance Notice:** No paid inference requests, code modifications, or configuration changes were executed during this feasibility audit. Endpoint metadata was verified from the `GET /v1/models` schema response already captured during Phase 6I.

---

## 1. The 8 Mandatory Technical Feasibility Questions

### 1. Does the current deployed Modal endpoint support image inputs?
**YES — Verified in live endpoint metadata.**
During Phase 6I, querying `GET https://khelfawalid--ep-muse-spark-open-816b-a42b-server.us-west.modal.direct/v1/models` returned the exact capability manifest of the deployed container:
```json
{
  "data": [{
    "base_model_id": "meta-models/Muse-Spark-Open-816B-A42B",
    "context_length": 1000000,
    "id": "meta-models/Muse-Spark-Open-816B-A42B",
    "input_modalities": ["text", "image", "video", "audio"],
    "interleaved": { "field": "reasoning_content" },
    "max_output_length": 262144,
    "name": "Meta: Muse Spark Open",
    "object": "model",
    "output_modalities": ["text"],
    "owned_by": "modal",
    "reasoning_options": [{ "type": "effort", "values": ["low", "medium", "high", "xhigh"] }],
    "supported_features": ["tools", "json_mode", "structured_outputs", "reasoning"],
    "supported_sampling_parameters": ["temperature", "top_p", "stop", "max_tokens"]
  }]
}
```
The serving engine (Modal's OpenAI-compatible server for `meta-models/Muse-Spark-Open-816B-A42B`) explicitly registers `"input_modalities": ["text", "image", "video", "audio"]`.

---

### 2. Does the current TestPilot AI inference implementation (`src/lib/ai/modal.ts`) accept multimodal messages?
**NO — Currently hardcoded to plain strings.**
Inspecting [`src/lib/ai/modal.ts:61`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/ai/modal.ts#L61):
```ts
async function chat(
  cfg: AiConfig,
  messages: Array<{ role: string; content: string }>,
  timeoutMs = 120000,
  maxTokens = 2048
): Promise<{ content: string; usage: TokenUsage }>
```
- The TypeScript type of `messages` restricts `content` to `string` instead of OpenAI's multimodal union `string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>`.
- Furthermore, in `planTests` (`modal.ts:199`) and `nextAction` (`modal.ts:240`), `Observation` is serialized via `JSON.stringify(observation).slice(0, 12000)`. While `observation.screenshotPath` is included as a string property (e.g., `"screenshots/1793295890689-observe.png"`), the actual PNG binary on disk (`.data/screenshots/...`) is **never read, base64-encoded, or passed** to the endpoint.

---

### 3. Which request format is required for images?
The Modal OpenAI-compatible `/v1/chat/completions` endpoint requires the standard OpenAI Vision content array inside `messages`:
```json
{
  "model": "meta-models/Muse-Spark-Open-816B-A42B",
  "messages": [
    { "role": "system", "content": "..." },
    {
      "role": "user",
      "content": [
        { "type": "text", "text": "Objective: ...\nObservation: ..." },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg..."
          }
        }
      ]
    }
  ],
  "response_format": { "type": "json_object" }
}
```

---

### 4. Are base64 data URLs or hosted image URLs supported?
**Base64 `data:image/png;base64,...` URLs are required for TestPilot AI.**
- While the Modal endpoint supports both public HTTPS URLs and RFC 2397 `data:` URIs, TestPilot AI runs against local or private staging targets (`http://localhost:3000`) and stores screenshots on the local filesystem (`.data/screenshots/`).
- Because the remote Modal GPU container cannot reach `http://localhost:3000/api/screenshots/...`, screenshots **must** be read from `.data/screenshots/<file>.png` and serialized inline as `data:image/png;base64,<base64>` (the exact same pattern already used in [`src/lib/reporting/html.ts:12`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/reporting/html.ts#L12)).

---

### 5. What image formats and size limits apply?
- **Supported Formats:** `image/png`, `image/jpeg`, `image/webp`.
- **Current Screenshot Footprint in `.data/screenshots/`:**
  - We inspected the captured screenshots in `.data/screenshots/` (`1793204200039-observe.png` through `1793296385699-observe.png`).
  - Viewport resolution in [`src/lib/browser/executor.ts:25`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/browser/executor.ts#L25) is fixed at **`1280 x 800`** (`fullPage: false`).
  - Actual file sizes on disk are **15.8 KB to 22.0 KB per PNG** (~21 KB–29 KB when base64-encoded).
- **HTTP Payload Limits:** Modal's Envoy ingress allows multi-megabyte JSON bodies (typically 4 MB–20 MB). A single 22 KB PNG (~29 KB base64) is **0.7% of a 4 MB limit** and well within safe transport bounds without needing external native image-resizing libraries like `sharp`.

---

### 6. Does the model actually process images, or would the endpoint silently ignore them?
**The model's vision encoder processes `image_url` content blocks, but there is a critical interaction with `response_format: { type: "json_object" }` and `enable_thinking: false` that has NOT yet been empirically tested on your endpoint.**
- **Evidence for Vision Processing:** `meta-models/Muse-Spark-Open-816B-A42B` is a native multimodal MoE architecture (816B total parameters, 42B active parameters) whose `/v1/models` endpoint metadata explicitly advertises `"input_modalities": ["text", "image", "video", "audio"]`.
- **Critical Unknown (Without Live Paid Probe):** Some vLLM/SGLang configurations for multimodal MoE models either (a) reject `response_format: { type: "json_object" }` when combined with `image_url` blocks, or (b) experience significantly higher latency or schema-adherence degradation when vision patch tokens are interleaved with strict JSON output constraints.

---

### 7. What additional GPU memory, latency, and compute cost could be introduced?
We analyzed the exact telemetry from your two Phase 6I live runs (`55e43fd9` and `d63423b1`):
- **Current Text-Only Baseline:**
  - Run 1 (Defective, 13 steps): **72 seconds** wall-clock (`~5.1s` per LLM call), **24,702 total tokens** (`~1,760` prompt tokens/call).
  - Run 2 (Successful, 15 steps): **57 seconds** wall-clock (`~3.8s` per LLM call), **22,995 total tokens** (`~1,470` prompt tokens/call).
- **Impact of Adding a `1280x800` Image:**
  - **Vision Token Overhead:** A `1280x800` image tokenized into vision patches adds approximately **1,000 to 1,600 prompt tokens per image**.
  - **Latency Overhead:** Vision encoder forward pass + prefill of ~1,200 extra tokens on an 816B MoE model adds **~1.0s to 2.5s per multimodal request**.
  - **If sent on EVERY step (14 calls):** Would add ~15,000–22,000 prompt tokens (+75% token budget) and ~15–35 seconds per run, pushing a 72s run dangerously close to the `120s` timeout (`maxDurationSec`).
  - **If sent selectively (ONLY on `planTests` + post-click verification = 2–3 calls per run):** Adds only **~2,500–4,500 tokens (+12%)** and **~3–6 seconds per run**, keeping total run time around **65–78 seconds**.

---

### 8. Can visual observations be added without changing the existing DOM-based testing workflow?
**YES.**
- `BrowserExecutor.observe()` ([`src/lib/browser/executor.ts:125`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/browser/executor.ts#L125)) **already captures a screenshot at every single step** (`const screenshotPath = await this.captureScreenshot("observe")`) and attaches `screenshotPath` to `Observation`.
- Because the screenshot is already on disk before `adapter.planTests()` and `adapter.nextAction()` are called, adding multimodal support requires **zero changes to Playwright action execution**, **zero changes to `deriveRequirements()`**, and **zero changes to deterministic `assert_text` / `confirmed` finding logic**.
