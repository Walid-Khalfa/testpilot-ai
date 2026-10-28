# Modal Billing Audit

## Endpoint type: Dedicated (not shared)

The active endpoint is a **Modal Dedicated Endpoint**:

- URL: `https://khelfawalid--ep-muse-spark-open-816b-a42b-server.us-west.modal.direct`
- Model: `meta-models/Muse-Spark-Open-816B-A42B` (Meta Muse Spark Open)
- Auth: proxy token (server-side only)

Dedicated endpoints bill for **compute (GPU time)**, not per-token. The per-token prices shown on the Modal model library page do NOT apply to this endpoint.

## What is NOT verified from the application

The following must be confirmed in the Modal dashboard (not exposed via API):
- GPU type and count
- Scale-to-zero setting
- Minimum/maximum replicas
- Idle timeout
- Actual $/hour compute rate

Please verify these in the dashboard and record them here before any public cost claims.

## Cost safety in the application

- Per-run `maxTokens` hard-stops the agent loop.
- `maxSteps`, `maxDurationSec`, `maxPages`, and `MAX_CONCURRENT_RUNS` bound compute time.
- Token usage is tracked per run for observability, but actual Modal charges are compute-based.
- No dedicated GPU or endpoint is created/modified by the application code.

## Estimated vs. actual cost

- `estimatedCostUsd` in reports uses per-token pricing as an approximation only.
- Actual charges = (GPU seconds) x (compute rate), available in the Modal dashboard.