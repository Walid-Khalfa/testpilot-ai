# PRIORITIZED ACTION PLAN — TESTPILOT AI
**Objective:** Maximize judging score before the Meta Global AI Developer Hackathon deadline without destabilizing the working prototype.

---

## Executive Guidance: Freeze vs. Fix?

**Do NOT do any large refactors, database migrations, authentication, Dockerization, or public cloud deployments.**
However, **do NOT freeze before applying the 4 surgical P0 fixes below (~40 minutes total).** Right now, your demo fixture leaks the words `"INTENTIONAL DEFECT"` to the model, and your `modal.ts` prompt instructs the model never to assert text unless it is already visible in the observation. Fixing those two issues + the 2-line locator visibility check transforms the project from "fragile demo" to "rock-solid technical submission."

---

## P0 — MUST FIX BEFORE SUBMISSION (~40 Minutes Total, Very Low Risk)

### P0-1: Remove "INTENTIONAL DEFECT" Spoiler Text from Demo Shop Fixtures
- **Problem:** `public/demo-shop/index.html` has `<title>Demo Shop — Checkout (INTENTIONAL DEFECT)</title>` and `<p>This page contains an intentionally introduced defect for TestPilot AI demonstration.</p>`. `BrowserExecutor.observe()` extracts both and sends them to Meta Muse Spark Open. As a result, your live run (`230850ed`) shows the model writing scenarios titled *"Verify checkout form submission does not display 'Order confirmed' - intentional defect present"* and reasoning *"despite intentional defect noted."* Judges who read that on screen will think the agent cheated by reading the banner.
- **Evidence:** [`public/demo-shop/index.html:5,17`](file:///c:/Users/wkhal/Documents/TestPilot-AI/public/demo-shop/index.html#L5-L17) and `.data/runs/230850ed-b2a7-4d80-b6f6-d62abee6c9c4.json`.
- **Proposed Solution:** Replace the spoiler title and paragraph in both `public/demo-shop/index.html` and `public/demo-shop/success.html` with realistic e-commerce checkout copy (e.g., `<title>Aurora Audio — Express Checkout</title>` and `<p>Order Summary: Aurora Wireless Headphones (x1) — Total: $149.00</p>`). Keep the exact same form IDs, labels (`Full name`, `Email`, `Shipping address`), button (`Place order`), and `#confirmation` div (`Order confirmed — thank you!`) so zero tests break.
- **Expected Judging Impact:** **CRITICAL (+5 to +8 points).** Eliminates the #1 reason a technical judge would dismiss the demo as rigged.
- **Estimated Effort:** 5 minutes.
- **Regression Risk:** Near zero (all 23 Vitest tests match on `Full name`, `Email`, `Shipping address`, `Place order`, and `Order confirmed`).
- **Worth Making Before Deadline?** **YES — Mandatory.**

---

### P0-2: Fix Self-Sabotaging System Prompts in `src/lib/ai/modal.ts`
- **Problem:**
  1. In `planTests` ([`src/lib/ai/modal.ts:195`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/ai/modal.ts#L195)): *"expectedResults must be concrete observable strings present in the application UI."* Because `planTests` runs on Step 0 (before form submission), the model only puts initial pre-submit page strings into `expectedResults`.
  2. In `nextAction` ([`src/lib/ai/modal.ts:236`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/ai/modal.ts#L236)): *"For assert_text, the text MUST be copied verbatim from the observation (headings or page text) or the scenario expectedResults; never invent expected text."* When a bug prevents `"Order confirmed"` from appearing in `observation`, this rule forbids the model from asserting `"Order confirmed"` unless rescued by the Phase 6H `Outstanding requirements` prompt!
- **Evidence:** Compare pre-Phase-6H live run `f5066ab1` (0 findings on defective page because model refused to assert `"Order confirmed"`) with post-Phase-6H run `230850ed`.
- **Proposed Solution:** Update the two system prompt sentences in `src/lib/ai/modal.ts`:
  - Line 195 (`planTests`): `"expectedResults must be concrete strings that should be visible in the UI when the objective succeeds (including strings explicitly quoted in the user's Objective or Instructions)."`
  - Line 236 (`nextAction`): `"For assert_text, use an explicit expected string from the user's Objective/Instructions, Outstanding requirements, scenario expectedResults, or current observation; do not invent unrelated text."`
- **Expected Judging Impact:** **HIGH (+3 to +4 points).** Aligns `planTests` and `nextAction` with Requirement Coverage so `scenarios[0].expectedResults` looks intelligent in the UI instead of listing pre-submit boilerplate.
- **Estimated Effort:** 5 minutes.
- **Regression Risk:** Low (unit tests in `modal-adapter.test.ts` only check invalid JSON and HTTP 401).
- **Worth Making Before Deadline?** **YES — Mandatory.**

---

### P0-3: Fix Hidden-Element False Positive in Locator-Scoped `assert_text`
- **Problem:** In [`src/lib/browser/executor.ts:223-230`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/browser/executor.ts#L223-L230), when `action.locator` is present on `assert_text`, it runs:
  ```ts
  const loc = this.resolveLocator(action.locator);
  const elText = await loc.first().innerText().catch(() => "");
  ok = (await loc.count()) > 0 && elText.toLowerCase().includes(action.text.toLowerCase());
  ```
  As proven in our Playwright probe (`hidden-probe.mjs`), `loc.first().innerText()` on `<div id="confirmation" style="display:none">Order confirmed — thank you!</div>` returns `"Order confirmed — thank you!"`! If Meta Muse Spark Open ever supplies `locator: { text: "Order confirmed" }` on `assert_text`, the defective checkout page will **falsely pass**.
- **Evidence:** [`src/lib/browser/executor.ts:227-229`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/browser/executor.ts#L227-L229).
- **Proposed Solution:** Add `const isVis = await loc.first().isVisible().catch(() => false);` and require `ok = isVis && elText.toLowerCase().includes(action.text.toLowerCase());`.
- **Expected Judging Impact:** **HIGH (+2 to +3 points).** Prevents a catastrophic live-demo false pass if the model decides to include a locator on `assert_text`, and backs up your claim in `docs/acceptance.md` that hidden DOM text can never satisfy an assertion.
- **Estimated Effort:** 5 minutes.
- **Regression Risk:** Very low (all existing tests use visible elements for positive assertions).
- **Worth Making Before Deadline?** **YES — Mandatory.**

---

### P0-4: Clean Stale `.data/runs/` and Update `docs/submission.md`
- **Problem:**
  1. `.data/runs/` currently contains 4 runs: 2 old pre-Phase-6H runs (`0e91075d`, `f5066ab1`) that have `requirements: []` and fail to detect the defect on `index.html`, and 2 Phase-6H runs (`230850ed`, `03fdbca4`) whose reasoning logs reference the `"intentional defect"` spoiler banner.
  2. [`docs/submission.md:27`](file:///c:/Users/wkhal/Documents/TestPilot-AI/docs/submission.md#L27) still says `"12 automated tests (unit + integration)"` instead of `23` and does not mention Requirement Coverage.
- **Proposed Solution:** After applying P0-1, P0-2, and P0-3, delete the old `.data/runs/*.json` files, run 1 fresh live defective run and 1 fresh live success run via the UI (approx. 18,000 tokens total on your Modal endpoint), and update `docs/submission.md` to cite 23 tests and Requirement Coverage.
- **Expected Judging Impact:** **HIGH (+2 points).** Ensures the dashboard and submission doc are 100% consistent and free of old broken runs during your demo video.
- **Estimated Effort:** 15 minutes.
- **Regression Risk:** Zero.
- **Worth Making Before Deadline?** **YES — Mandatory.**

---

## P1 — HIGH-IMPACT IMPROVEMENTS IF TIME PERMITS (~30–45 Minutes)

### P1-1: Fix the Apostrophe Bug in `deriveRequirements()` (`runner.ts:17`)
- **Problem:** `text.match(/["']([^"']{2,80})["']/g)` pairs an apostrophe in words like `user's` or `don't` with the next single or double quote, corrupting requirement extraction.
- **Evidence:** [`src/lib/agent/runner.ts:17`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/agent/runner.ts#L17).
- **Proposed Solution:** Match double-quoted and single-quoted strings separately, requiring single quotes not to be preceded by a word character:
  ```ts
  const matches = [
    ...(text.match(/"([^"]{2,80})"/g) || []),
    ...(text.match(/(?:^|[^\w])'([^']{2,80})'/g) || []).map((m) => m.replace(/^[^\w']/, "")),
  ];
  ```
- **Expected Judging Impact:** **MEDIUM (+1 point).** Prevents embarrassing requirement parsing bugs if you or a judge type an apostrophe in the objective.
- **Estimated Effort:** 5 minutes.
- **Regression Risk:** Very low.

### P1-2: Implement the Missing Console/Network Error Findings (`runner.ts:285`)
- **Problem:** [`src/lib/agent/runner.ts:285-286`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/agent/runner.ts#L285-L286) has a comment `// Console errors as suspected findings (once)` with no code underneath. Console and HTTP >= 400 errors captured by `BrowserExecutor` are thrown away.
- **Proposed Solution:** Add 10 lines under `runner.ts:285` to check `observation.consoleErrors` and `observation.networkErrors` and push a `suspected` finding (with `result.screenshotPath`) if one is observed.
- **Expected Judging Impact:** **MEDIUM-HIGH (+2 points).** Directly answers the judge question: *"Can it detect bugs that aren't explicitly quoted in the objective, like HTTP 500s or uncaught JS exceptions?"*
- **Estimated Effort:** 10 minutes.
- **Regression Risk:** Low (verify `agent.test.ts` and `requirement-coverage.test.ts` still pass since `demo-shop` only logs `console.log`, not `console.error`).

### P1-3: Enforce `this.policy.localDemo` in Playwright Egress Filter (`executor.ts:32`)
- **Problem:** [`src/lib/browser/executor.ts:31-37`](file:///c:/Users/wkhal/Documents/TestPilot-AI/src/lib/browser/executor.ts#L31-L37) allows subresource requests to `localhost`/`127.0.0.1` even when `localDemo` is `false`.
- **Proposed Solution:** Change `isLocal` in `executor.ts:35` to `(isLocal && this.policy.localDemo)`.
- **Expected Judging Impact:** **LOW-MEDIUM (+1 point).** Closes a real SSRF bypass in your security layer.
- **Estimated Effort:** 2 minutes.
- **Regression Risk:** Zero (all local demo runs and tests set `ALLOW_LOCAL_DEMO=true`).

---

## P2 — OPTIONAL ENHANCEMENTS (Only If Ahead of Schedule)

### P2-1: Filter Invisible Elements Out of `observe()` (`executor.ts:116-118`)
- **Problem:** `page.locator("h1,h2,h3").allInnerTexts()` and `visibleTextRaw` include hidden elements if they match those tags.
- **Proposed Solution:** Filter `h1,h2,h3` and `p, li...` by `:visible` pseudo-selector in Playwright (`page.locator("h1:visible, h2:visible, h3:visible")`).
- **Effort:** 5 minutes | **Risk:** Low.

### P2-2: Remove Silent `formFields[0]` Fallback in `modal.ts:263-276`
- **Problem:** Silently substituting `formFields[0]` when the model omits `locator` bypasses the Zod self-repair retry loop.
- **Proposed Solution:** Delete lines 260–277 in `src/lib/ai/modal.ts` so `AgentDecisionSchema.parse(parsed)` throws and triggers the 3-attempt retry loop with error feedback.
- **Effort:** 5 minutes | **Risk:** Low-Medium (may increase token usage if the model omits locators).

---

## POST-HACKATHON — DO NOT IMPLEMENT BEFORE DEADLINE

| Item | Why You Must Skip It Now |
|---|---|
| **Public Cloud Deployment (Vercel / Railway / Docker)** | Next.js API routes spawning headless Chromium + writing to `.data/` will fail on serverless read-only filesystems (Vercel) and hit 10–60s function timeouts. Not required for Indie Track. |
| **Supabase / PostgreSQL Migration** | File-based JSON storage works deterministically for local demo and tests. |
| **Authentication / NextAuth / Clerk** | Zero judging value for a 3-minute solo developer AI track demo. |
| **WebSockets / SSE Streaming for `/execute`** | Modifying the synchronous execution flow risks UI race conditions right before submission. In the video, either let the 16-second live run play in real time (showing the Modal latency honestly) or jump-cut cleanly with a timer overlay. |
| **PDF Report Export** | Your standalone HTML report with base64 embedded screenshots is already cleaner and more inspectable than a PDF. |
