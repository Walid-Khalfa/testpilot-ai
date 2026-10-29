# Acceptance Matrix

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Working UI dashboard | PASS | `npm run build`; dashboard renders projects/runs |
| 2 | Project creation with authorization | PASS | `/projects/new` form + `/api/projects` |
| 3 | Safe browser observation | PASS | `BrowserExecutor.observe()` captures URL/title/headings/elements/forms/console/network + screenshot |
| 4 | Meta (Muse Spark Open) inference | PASS | `/api/ai/ping` ok:true; run recorded model id + tokens |
| 5 | Real Playwright execution | PASS | Steps executed navigate/fill/click/assert; screenshots captured |
| 6 | Autonomous decision loop | PASS | End-to-end run completed (observe→reason→plan→act→verify→adapt→report) |
| 7 | Evidence-based report | PASS | `/api/runs/[id]/report` returns HTML with actions/assertions/findings/repro steps |
| 8 | Defective scenario → confirmed finding | PASS | Defect run: 1 confirmed finding with screenshot + repro steps |
| 9 | Successful scenario → no confirmed defects | PASS | Integration test `success scenario has no confirmed findings` passed |
| 10 | SSRF protection / domain allowlist | PASS | `tests/unit/url-safety.test.ts` (3 tests) |
| 11 | Bounded runs (steps/duration/pages/tokens) | PASS | Enforced in `executeRun`; verified in runs |
| 12 | No arbitrary JS execution | PASS | Typed action schema; no eval in executor |
| 13 | Typecheck / lint / tests / build | PASS | 0 errors; 23 tests passed; build succeeded |
| 22 | Requirement coverage (user-authored) | PASS | 7 integration tests; pass/fail/blocked verified |
| 14 | Screenshots in UI | PASS | `/api/screenshots` + Image components |
| 14b | Live Meta inference (real request + tokens) | PASS | `/api/ai/ping` ok:true; run recorded 24k+ tokens |
| 15 | Modal billing type documented | PASS | `docs/modal-billing.md` (dedicated, compute-based) |
| 16 | Actual GPU type / scale-to-zero | NOT VERIFIED | Dashboard-only; not exposed via API |
| 17 | Actual Modal compute cost | NOT VERIFIED | Dedicated endpoint; compute seconds x rate (dashboard) |
| 18 | PDF export | NOT VERIFIED | HTML only (P2) |
| 19 | Multi-user auth | NOT VERIFIED | Out of MVP scope |
| 20 | Live Meta tool-calling quality | PARTIAL | Model returns valid JSON after retry/normalization; structured output works |
## Regression verification (Phase 6E)

- assert_text with a locator requires the expected text in that element (regression test added).
- Hidden DOM text alone cannot confirm a defect (regression test added).
- Navigation failure records a failed run (regression test added).
- Turbopack build remains environment-specific; Webpack fallback verified.

