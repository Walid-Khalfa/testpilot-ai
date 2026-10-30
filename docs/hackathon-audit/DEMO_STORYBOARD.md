# 3-MINUTE DEMO STORYBOARD — TESTPILOT AI
**Target Duration:** 2 minutes 45 seconds (leaves a 15-second safety buffer under the 3:00 limit)
**Core Narrative Arc:** *"AI browser agents hallucinate passing tests when UI actions silently fail, or hallucinate fake bugs from LLM speculation. TestPilot AI uses Meta Muse Spark Open with a deterministic Requirement Coverage & Oracle Grounding engine to prove real software defects with zero false positives."*

---

## Pre-Recording Checklist (Crucial!)

1. **Apply P0-1 & P0-2 first** so `public/demo-shop/index.html` does **not** display `"INTENTIONAL DEFECT"` on screen or in the model's reasoning trace.
2. **Pre-open 4 browser tabs** at `1280x800` or `1920x1080` (125% zoom so text is crisp on video):
   - **Tab 1:** `http://localhost:3000/api/ai/ping` (or terminal showing `curl -s http://localhost:3000/api/ai/ping | jq` returning `"ok": true, "modelId": "meta-models/Muse-Spark-Open-816B-A42B"`).
   - **Tab 2:** `http://localhost:3000/projects/new` (New Project form pre-populated).
   - **Tab 3:** `http://localhost:3000/demo-shop/index.html` (The target checkout page).
   - **Tab 4:** A completed **Control Run (`success.html`)** and **Downloaded HTML Report** ready for instant comparison.

---

## Second-by-Second Storyboard

### `0:00 – 0:22` | The Hook: Why Current AI QA Fails (22s)
- **On Screen:**
  - Start directly on the **TestPilot AI Dashboard (`http://localhost:3000`)** alongside the **Target Checkout Page (`demo-shop/index.html`)** in a split view.
  - Briefly click `"Place order"` on the target page to show the silent bug: the button clicks, nothing crashes, no HTTP 500 appears, yet **no order confirmation is ever shown**.
- **Voiceover:**
  > *"When a checkout button silently swallows a form submission without throwing an exception, traditional scripts brittle-break on selectors, while naive AI browser agents click 'Submit', see no crash, and hallucinate 'Task Completed!' Worse, when AI agents do flag bugs, they often invent expectations the developer never asked for. I built TestPilot AI on Meta Muse Spark Open to solve both problems: an autonomous QA agent that enforces explicit Requirement Coverage and separates grounded, evidence-backed defects from LLM speculation."*

---

### `0:22 – 0:50` | Live Meta Muse Spark Open Verification & Project Setup (28s)
- **On Screen:**
  - Show `/api/ai/ping` response (or terminal header) confirming live connection to `meta-models/Muse-Spark-Open-816B-A42B` on Modal (`"ok": true`).
  - Switch to **`/projects/new`**. Highlight:
    1. **Target URL & Authorized Domain** (`localhost` allowlist + SSRF guard checkbox).
    2. **Testing Objective:** `"Verify the checkout form submits and displays 'Order confirmed'."` Point cursor at the quoted string `'Order confirmed'`.
    3. **Safety Budgets:** `Max duration: 120s`, `Max steps: 20`, `Max tokens: 50,000`.
  - Click **Create project**.
- **Voiceover:**
  > *"TestPilot AI connects to a dedicated Modal endpoint running Meta Muse Spark Open 816B-A42B. When creating a project, we enforce domain allowlisting, DNS-level SSRF protection, and hard execution budgets. Notice the quoted phrase `'Order confirmed'` in our objective: TestPilot AI extracts this as a mandatory user-authored requirement. The agent cannot finish early until this requirement is tested in a real browser."*

---

### `0:50 – 1:35` | Autonomous Execution Loop (`Observe → Plan → Reason → Act → Verify → Adapt`) (45s)
- **On Screen:**
  - Click **"Run test"** on the defective checkout project.
  - *(Note: Live Modal execution takes ~18–24 seconds. Keep a small "2x speed — live Modal inference" badge in the corner for 8 seconds during the wait, OR show the headless browser / server log alongside it, then land on the completed Run page `/runs/[id]`.)*
  - On the **Run Detail Page (`/runs/[id]`)**, scroll smoothly through:
    1. **Header & Telemetry:** `Modal — Meta Muse Spark Open (meta-models/Muse-Spark-Open-816B-A42B)`, `8 steps`, `~9,900 tokens`.
    2. **Scenarios & Timeline:** Highlight the `observe`, `plan`, `reason` (with Muse Spark Open's step-by-step rationale), `act` (`fill` Full name, Email, Shipping address, `click` Place order), and `verify` (`Assertion FAILED: Assert text "Order confirmed" is present`).
- **Voiceover:**
  > *"In a single autonomous run, TestPilot AI launches headless Chromium via Playwright, observes the DOM accessibility tree, and asks Meta Muse Spark Open to generate a structured test plan validated by Zod. At each step, Muse Spark Open reasons over the live page state, synthesizes realistic test inputs for Full Name, Email, and Shipping Address, clicks Place Order, and executes a visibility-aware Playwright assertion for `'Order confirmed'`."*

---

### `1:35 – 2:10` | The Differentiator: Requirement Coverage & Confirmed vs. Suspected Grounding (35s)
- **On Screen:**
  - Zoom in on three sections of the Run page:
    1. **Requirement Coverage Table:** Shows `Order confirmed` | `Source: objective` | **`Status: failed`**.
    2. **Findings Card:** Highlight the **`high`** severity badge and **`confirmed`** status badge, the **Repro Steps** (showing `(input value redacted)` for privacy), and the **Captured Screenshot** proving the confirmation banner never appeared after submission.
- **Voiceover:**
  > *"Here is what separates TestPilot AI from generic browser agents: First, our Requirement Coverage gate blocked the agent from finishing until `'Order confirmed'` was evaluated, marking the requirement `failed`. Second, our Oracle Grounding engine promoted this finding to `confirmed` ONLY because the expected text was grounded in the user's explicit objective and backed by a failed Playwright assertion with screenshot evidence. Any ungrounded assertion invented by the model is automatically quarantined as `suspected`—eliminating AI false positives."*

---

### `2:10 – 2:45` | Control Comparison (`0 Findings`) & Standalone HTML Audit Report (35s)
- **On Screen:**
  - Switch to the **Control Run (`/runs/03fdbca4...`)** against `success.html`.
  - Point out: Same model (`Muse-Spark-Open-816B-A42B`), same objective, **Requirement `Order confirmed`: `passed`**, **Findings: `0`**.
  - Click **"Download report"** on the defective run and open the standalone `.html` file in the browser, showing embedded base64 screenshots, token usage, and reproduction steps.
  - End briefly on a terminal showing `npx vitest run` (`23 passed (23)`).
- **Voiceover:**
  > *"When we run the exact same objective against the patched checkout flow, Meta Muse Spark Open executes the 7-step flow, verifies `'Order confirmed'` is visibly rendered, marks the requirement `passed`, and records zero false positives. Every run exports a self-contained HTML audit report with embedded base64 screenshots, redacted reproduction steps, and token telemetry—backed by 23 automated unit and integration tests. TestPilot AI turns Meta Muse Spark Open into a verifiable, zero-hallucination QA engineer."*

---

## What Must NOT Appear in the Video

1. **DO NOT show `"INTENTIONAL DEFECT"` or `"This page contains an intentionally introduced defect"`** in the target page title, page body, scenario title, or reasoning logs. (Apply P0-1 & P0-2 before recording!)
2. **DO NOT show 25 seconds of dead air** staring at a static `"Running..."` button. Either show the terminal/network activity alongside the UI or use a clearly labeled `"2x speed (live inference)"` speed-ramp during the 20-second HTTP call.
3. **DO NOT show `MockModelAdapter` (`mock-deterministic`)** in the main demo flow. Judges must see `Modal — Meta Muse Spark Open (meta-models/Muse-Spark-Open-816B-A42B)` and real non-zero token counts (`~8,000–10,000` tokens). Mention the Mock Adapter only briefly at the end when showing the 23 Vitest regression tests.
4. **DO NOT spend time walking through boilerplate code** (`package.json`, standard Next.js routes, or Tailwind CSS). If you show code for 10 seconds, show only `runner.ts` lines 241–256 (the `grounded` `confirmed` vs. `suspected` check) or `modal.ts` Zod validation.
5. **DO NOT claim `estimatedCostUsd` is your actual Modal bill** — if mentioned, state accurately that the dedicated Modal endpoint bills by GPU compute time while token cost is tracked for observability.
