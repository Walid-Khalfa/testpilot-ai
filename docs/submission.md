# Hackathon Submission — TestPilot AI

## Track
Meta Global AI Developer Hackathon 2026 — Indie Developer — "Push the Frontier"

## Problem
Manual QA is slow and AI test generators often fabricate results. Developers need an agent that actually explores, executes, and proves defects with evidence.

## Solution
TestPilot AI is an autonomous, verifiable QA agent: OBSERVE → REASON → PLAN → ACT → VERIFY → ADAPT → REPORT. It uses Meta Muse Spark Open (via Modal) as the core reasoning/planning model, drives a real Playwright browser, captures screenshots and logs, and produces an evidence-backed HTML report.

## Meta AI usage (central, not decorative)
- Meta Muse Spark Open is invoked for test planning (`planTests`) and next-action selection (`nextAction`).
- Structured JSON outputs are validated with Zod; malformed responses are rejected and retried.
- Model identity, token usage, and estimated cost are shown in the UI and report.
- Verified via live request: `/api/ai/ping` returns ok:true with non-zero tokens.

## Technical execution
- Next.js 16 (App Router, strict TS), Tailwind, Zod.
- Playwright browser executor with accessibility locators, SSRF protection, domain allowlisting, egress restriction, bounded runs.
- File-based storage with repository interfaces (Supabase-ready).
- Requirement Coverage engine tracking explicit user-authored requirements (`not_tested`, `passed`, `failed`, `blocked`) with termination gating and grounded defect classification (`confirmed` vs. `suspected`).
- 47 automated tests (unit + integration), typecheck, lint, build all pass.

## Evidence
- Paired realistic checkout fixtures (defective submit failure vs. working confirmation).
- Agent detects silent submission failure via real Playwright visibility-aware assertion, captures screenshot, and emits a confirmed finding with reproduction steps and requirement failure.
- Control scenario executes cleanly with requirement passed and 0 findings.
- Downloadable HTML report includes metadata, requirement coverage, scenarios, actions, assertions, findings, timeline, tokens/cost.

## Security
- Explicit authorization confirmation, domain allowlisting, URL normalization, DNS/IP validation, SSRF protection, redirect validation, bounded execution, no arbitrary JS/eval, secrets via env only.

## Limitations
- Dedicated Modal endpoint bills compute (GPU time), not per-token; `estimatedCostUsd` is an approximation.
- File-based storage (not durable across deployments).
- No PDF export, auth, or multi-user support in MVP.
- Model may occasionally invent expected text; such findings are marked suspected, not confirmed.

## Setup
See README.md and `.env.example`. Requires Node.js 20+, Playwright browsers, and (for live inference) a Modal proxy token + dedicated endpoint.