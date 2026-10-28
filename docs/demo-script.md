# Demo Script — TestPilot AI (3 minutes)

**Setup:** dev server running, `.env.local` configured with Modal dedicated endpoint, browser open on dashboard.

## 0:00–0:20 — Problem & solution
- "TestPilot AI is an autonomous QA agent, not just a test-case generator."
- Show dashboard (empty state → projects).

## 0:20–0:40 — Create project
- Click "New project"; use defaults (defective demo fixture, localhost, authorization confirmed).
- Point out scope limits: max steps/duration/pages/tokens, domain allowlist.

## 0:40–1:10 — Live Meta AI planning
- Click "Run test". Timeline shows: Browser started · Model: Meta Muse Spark Open.
- "Observe" → "Plan: generated N scenarios" (real Modal inference).
- Show token count updating.

## 1:10–1:50 — Autonomous execution
- Timeline: fill fields → click submit → assert "Order confirmed" → FAIL.
- Highlight: agent adapts, records suspected/confirmed defect with screenshot.

## 1:50–2:20 — Findings & evidence
- Scroll to Findings: "Confirmed defect" with severity, repro steps, screenshot.
- Show Actions table and Assertions.

## 2:20–2:45 — Report
- Click "Download report"; open HTML report (metadata, scenarios, actions, findings, timeline, tokens/cost).

## 2:45–3:00 — Architecture & safety
- Show README architecture diagram + security (SSRF, no eval, bounded runs).
- Closing: "Real Meta model, real Playwright, real evidence."

## Notes
- Use the defective fixture (`/demo-shop/index.html`) for the confirmed finding.
- Keep maxSteps=12, maxTokens=25000 for ~30s run.