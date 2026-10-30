# Hackathon Value Assessment — MCP + RAG for TestPilot AI

## Options compared

| Option | Scope | Complexity | Demo value | Risk | Time | Recommendation |
|---|---|---|---|---|---|---|
| A: MCP only | 4 read-only tools + auth | Medium | Medium (interoperability) | Medium (auth) | 3–4 days | Conditional |
| B: RAG only | Keyword retrieval + provenance | Low-Medium | High (requirements-grounded testing) | Low | 3–4 days | **Strong** |
| C: Minimal MCP + RAG | Read-only MCP + keyword RAG | Medium | Highest (interoperability + grounding) | Medium | 5–7 days | Best if time allows |

## Evaluation criteria

1. **Implementation complexity:** RAG is simpler (no auth surface). MCP requires auth + transport hardening.
2. **Dependency footprint:** RAG adds no new dependencies. MCP adds `@modelcontextprotocol/sdk`.
3. **Security impact:** RAG adds document ingestion surface (mitigated by size limits/sanitization). MCP adds unauthorized-execution risk if rushed.
4. **Impact on 33-test baseline:** Both are additive; no existing tests broken if implemented as new modules.
5. **Additional latency:** RAG adds <50ms keyword search. MCP adds network round-trip.
6. **Inference/infra costs:** No new paid model; uses existing Modal endpoint (or none for RAG).
7. **Risk of breaking multimodal:** Low — both are additive, existing runner untouched except optional context injection.
8. **Demo value for judges:** RAG demonstrates requirements-grounded testing (clear, visible provenance). MCP demonstrates interoperability (visible tool discovery). Combined is strongest.
9. **Time to implement & validate:** RAG ~3–4 days; MCP ~3–4 days; combined ~5–7 days.
10. **Genuine product improvement:** RAG directly improves test quality (grounded expectations). MCP improves ecosystem integration.

## Main security and regression risks

- MCP `start_run` without auth → unauthorized browser execution / Modal compute drain.
- RAG document injection → prompt injection via uploaded specs (mitigated by sanitization + treating docs as data).
- RAG provenance fabrication → must not invent IDs/citations.
- Regression risk: runner changes must preserve requirement-coverage invariants and confirmed/suspected classification.

## Final answers

1. **Is MCP technically feasible?** Yes — thin adapter over existing services.
2. **Which MCP tools first?** Read-only: status, findings, report, requirements. Defer `start_run`.
3. **Does it need a vector DB?** No — keyword retrieval suffices for demo corpus.
4. **Provenance maintenance:** deterministic IDs, source doc/section, score, stored in run/report.
5. **Coexistence with multimodal:** additive; both feed model reasoning; security controls preserved.
6. **Smallest viable implementation:** RAG only (Option B) if time is short.
7. **Estimated effort:** RAG 3–4 days; MCP 3–4 days; combined 5–7 days.
8. **Main risks:** auth surface (MCP), prompt injection (RAG), regression to invariants.
9. **Strongest hackathon value:** Option C (combined) if time allows; otherwise Option B (RAG).
10. **Should we implement MCP, RAG, both, or neither?** **Implement RAG first (Option B).** Add read-only MCP (Option A) only if time permits after RAG is validated. Do not implement `start_run` MCP before the deadline. Neither is mandatory for submission; both are enhancements. Given current completion state, RAG provides the highest incremental value.