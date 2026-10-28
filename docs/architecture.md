# Architecture

## Overview

Single Next.js 16 (App Router) application with strict TypeScript. Modules under `src/lib` keep clear boundaries:

- `schemas/` — Zod schemas and shared types
- `security/` — URL safety, SSRF guards, policy
- `browser/` — Playwright executor, observation, screenshots
- `ai/` — ModelAdapter interface, Mock adapter, Modal adapter
- `agent/` — run state machine and cancellation
- `storage/` — repository interfaces + file-based adapter
- `reporting/` — HTML report rendering

## Data flow

OBSERVE → REASON → PLAN → ACT → VERIFY → ADAPT → REPORT

1. BrowserExecutor observes the page (URL, title, headings, interactive elements, form fields, console/network errors, screenshot).
2. ModelAdapter.planTests produces a validated TestPlan.
3. Loop: observe → nextAction (validated by Zod) → policy check → execute one Playwright action → collect evidence → assertion evaluation → adapt (record findings) → persist.
4. Run persisted after each step; HTML report generated on demand.

## Security boundary

AI proposals never execute directly. Every action passes through:
- Zod schema validation
- policy validation (domain allowlist, URL safety)
- typed Playwright executor (no eval, no arbitrary JS)

Webpage content is treated as untrusted input. Prompt-injection text inside pages is never followed.