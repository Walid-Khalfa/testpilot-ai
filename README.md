# TestPilot AI

**Autonomous, evidence-driven AI-powered web QA testing agent.**

Built for the **Meta Global AI Developer Hackathon 2026** - Indie Developer track, *Push the Frontier*.

TestPilot AI uses Meta Muse Spark Open to reason about web applications, select browser actions, and guide autonomous testing. Playwright executes real browser interactions and assertions, while the application records findings, screenshots, requirement coverage, and reproducible QA evidence.

The project is a **local demonstration MVP**, not a production-ready testing service.

## Key Features

- **Autonomous QA agent:** Observe → Reason → Plan → Act → Verify → Adapt → Report.
- **Meta-powered reasoning:** Meta Muse Spark Open generates testing scenarios and selects browser actions.
- **Multimodal observations:** Screenshots can be supplied to the model alongside structured browser observations.
- **Real browser automation:** Playwright executes typed actions, including navigation, form interactions, clicks, and assertions.
- **Requirements RAG:** Upload TXT or Markdown specifications and retrieve relevant requirements using deterministic keyword matching.
- **Requirement coverage:** Track expected outcomes as `not_tested`, `in_progress`, `passed`, `failed`, or `blocked`.
- **Evidence-backed findings:** Record failed assertions, screenshots, execution history, and reproduction information.
- **HTML reporting:** Download self-contained reports containing execution details and embedded screenshots.
- **Deterministic mock mode:** Exercise the workflow locally without paid inference.
- **Safety controls:** Target allowlists, action validation, execution limits, and isolated browser contexts.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | Next.js 16, React, TypeScript, Tailwind CSS |
| AI model | Meta Muse Spark Open |
| Model inference | Modal dedicated endpoint |
| Browser automation | Playwright |
| Schema validation | Zod |
| Requirements retrieval | Deterministic keyword-based RAG |
| Storage | File-based repository adapters |
| Testing | Vitest |
| Reporting | Self-contained HTML |

## Architecture

TestPilot AI follows a bounded agent workflow:

1. **Observe:** Collect browser state, visible text, interactive elements, and screenshots.
2. **Reason:** Send structured observations to Meta Muse Spark Open.
3. **Plan:** Generate test scenarios from the testing objective.
4. **Act:** Select and execute permitted Playwright actions.
5. **Verify:** Evaluate browser assertions against expected outcomes.
6. **Adapt:** Use execution history and failures to select subsequent actions.
7. **Report:** Persist execution evidence, findings, and requirement coverage.

The initial plan is generated once. The agent can adapt subsequent actions, but full dynamic replanning is not currently implemented.

Model-generated decisions are validated before execution. Browser actions and assertions are performed by application code rather than by arbitrary model-generated JavaScript.

## Getting Started

### Prerequisites

- Node.js and npm compatible with Next.js 16.
- Playwright browser dependencies.
- A local development environment.
- Optional Modal endpoint credentials for live Meta inference.

### Installation

Clone the repository:

```bash
git clone https://github.com/Walid-Khalfa/testpilot-ai.git
cd testpilot-ai
npm install
npx playwright install chromium
```

### Environment configuration

Create `.env.local` using the documented environment variable names.

If a tracked `.env.example` is available:

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux:**

```bash
cp .env.example .env.local
```

Configure the local demo setting:

```dotenv
ALLOW_LOCAL_DEMO=true
```

For live inference, configure the Modal provider and the required endpoint credentials as documented in the project.

**Important:** The October 31 audit found that `.env.example` was not tracked in Git. The template must be added before the copy commands above can work on a fresh clone. Do not commit real credentials.

### Start the application

For the recommended local-only demonstration:

```bash
npm run dev:local
```

Open:

http://127.0.0.1:3000

This command is intended to bind the application to the loopback interface.

Do not expose the MVP directly to the public internet. Its application APIs do not implement production-grade authentication or authorization.

## Running the Demo

TestPilot AI includes two controlled checkout fixtures.

| Fixture | Purpose |
|---|---|
| `/demo-shop/index.html` | Defective checkout |
| `/demo-shop/success.html` | Successful checkout |

### Defective checkout

1. Open the dashboard.
2. Create a new project.
3. Select the authorized local demo shop.
4. Enter a testing objective requiring the confirmation text `"Order confirmed"`.
5. Start the test run.
6. Review the executed browser actions and assertions.
7. Inspect the missing-confirmation finding and screenshot.
8. Download the HTML report.

The defective fixture intentionally prevents the confirmation message from appearing.

Historical live-model runs have demonstrated this defect with recorded browser actions, failed assertions, and screenshot evidence.

### Successful checkout

Run the same expectation against:

```text
http://127.0.0.1:3000/demo-shop/success.html
```

The successful fixture displays the expected confirmation.

Historical runs have demonstrated a passing requirement with no confirmed findings.

These examples validate the controlled scenarios; they do not establish a general false-positive rate.

## Meta Muse Spark Open Integration

TestPilot AI integrates:

```text
meta-models/Muse-Spark-Open-816B-A42B
```

through a Modal dedicated inference endpoint using an OpenAI-compatible API.

The adapter is implemented in:

```text
src/lib/ai/modal.ts
```

The model is responsible for generating scenarios, reasoning about browser observations, and selecting permitted actions.

The application performs deterministic execution, assertion evaluation, state tracking, and report generation.

### Multimodal Reasoning

The adapter supports image-bearing requests containing screenshot data alongside textual observations.

Multimodal requests are selective rather than mandatory for every action.

A text-only fallback is available when multimodal processing fails.

Historical execution records demonstrate image-bearing inference. However, improvements in accuracy or speed attributable specifically to vision have not been established through controlled benchmarks.

### Mock Mode

A deterministic mock adapter is available for local development and automated testing.

Mock execution is explicitly distinct from live Meta inference.

### Inference Costs

Modal dedicated endpoints are billed according to their compute configuration and usage.

Token counts are recorded for observability when provided by the inference service.

The application's `estimatedCostUsd` value is an approximation, not a verified Modal invoice or GPU cost measurement.

Consult `docs/modal-billing.md` and the Modal dashboard for infrastructure and billing information.

Stop unused dedicated compute resources to avoid unnecessary charges.

## Requirements RAG

TestPilot AI supports lightweight retrieval-augmented testing from uploaded specifications.

### Supported documents

- Plain text (`.txt`).
- Markdown (`.md`).

### Retrieval workflow

1. Upload a specification to a project.
2. Extract candidate requirements from supported text patterns.
3. Assign deterministic identifiers.
4. Retrieve relevant candidates using keyword overlap.
5. Add retrieved information to the agent's execution context.
6. Record available retrieval metadata and coverage information.

The current implementation uses keyword-based retrieval with a relevance threshold and a maximum of three retrieved requirements.

It does not use vector embeddings, semantic search, or a vector database.

### Important limitations

Requirements RAG is an experimental MVP capability.

- Extraction is limited to supported quoted-text and requirement-language patterns.
- Retrieved requirements influence action selection after the initial planning stage.
- Requirement verification relies on narrow assertion matching.
- Some specification-only requirements may remain unverified or blocked.
- Provenance may be incomplete after deduplication.
- The HTML report does not yet display all document identifiers, sections, and retrieval scores.
- Uploaded documents must be treated as untrusted data; prompt-injection resistance is not guaranteed.

Therefore, TestPilot AI should not be described as providing comprehensive specification-to-test traceability or complete automatic requirements verification.

## Requirement Coverage

The agent tracks explicit expected outcomes independently of model-generated hypotheses.

Supported coverage states:

| State | Meaning |
|---|---|
| `not_tested` | No relevant assertion has been evaluated |
| `in_progress` | Defined state; not consistently assigned by the current runner |
| `passed` | A matching assertion succeeded |
| `failed` | A matching assertion failed |
| `blocked` | Verification could not be completed within the execution constraints |

Coverage is currently based on limited requirement extraction and exact assertion matching.

A confirmed finding should not be interpreted as a guarantee that a defect is reproducible across arbitrary applications.

Known limitations include premature assertion failures, incomplete reconciliation of later successful assertions, and narrow grounding rules.

## QA Reports

TestPilot AI generates downloadable HTML reports containing available execution evidence, including:

- Run metadata and execution status.
- Model and token telemetry.
- Browser action history.
- Assertions and findings.
- Screenshots.
- Reproduction information.
- Requirement coverage.
- Available requirement-source metadata.

Screenshots can be embedded directly in the HTML report.

Document-level provenance is not yet fully represented in the report.

PDF export is not currently supported.

## Validation

Run the automated checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build:webpack
```

**Audited baseline - October 31, 2026:**

- 47 automated tests passed across 8 files.
- TypeScript validation passed.
- ESLint completed with zero warnings.
- Webpack build completed.

**Build limitation:** The audit identified missing Tailwind utility styling in the Webpack production output. The local development interface rendered correctly.

Use `npm run dev:local` for the hackathon demonstration until the production styling issue is resolved.

Passing automated tests does not establish broad reliability across arbitrary websites.

## Security

TestPilot AI is intended for testing applications that the operator is explicitly authorized to access.

Implemented controls include:

- Explicit target authorization confirmation.
- URL and domain validation.
- Selected SSRF and private-network checks.
- Typed browser actions.
- Zod validation of model decisions.
- Isolated Playwright browser contexts.
- Step, time, and token budgets.
- Screenshot-path restrictions.
- HTML escaping for report text.

### Security limitations

The current MVP does not provide complete protection against malicious targets or users.

Known limitations include:

- Incomplete network egress and SSRF enforcement.
- Unauthenticated project, run, and inference endpoints.
- Localhost Host-header checks that do not constitute authentication.
- Potential prompt injection from retrieved documents.
- Best-effort token, duration, and concurrency limits.
- File-storage identifier and path-containment weaknesses.
- No production-grade tenant isolation.

**Only run the local demo with trusted specifications and authorized fixtures.**

Do not expose the application as a publicly accessible service without further security hardening.

See `docs/security.md`.

## Project Status

The following capabilities have been implemented:

- Application foundation and project dashboard.
- Playwright browser execution.
- Meta Muse Spark Open model adapter.
- Autonomous agent orchestration.
- Multimodal screenshot input.
- Requirement Coverage.
- Lightweight requirements RAG.
- Evidence-backed HTML reporting.
- Automated regression tests.
- Local checkout demonstration fixtures.

The application is feature-frozen for hackathon submission.

## Known Limitations

- Local MVP only; no production authentication or multi-user support.
- File-based storage under `.data/`, unsuitable for durable cloud deployment.
- Synchronous execution may exceed serverless request timeouts.
- No PDF report export.
- No PDF specification ingestion.
- No semantic/vector RAG.
- No MCP integration.
- No guaranteed recovery or dynamic replanning.
- Narrow requirement-to-assertion matching.
- Incomplete requirement provenance in reports.
- Limited finding reconciliation.
- No validated general false-positive rate.
- Best-effort execution and inference budgets.
- Production Webpack styling issue.
- No verified Modal GPU spending guarantee.

## Hackathon Submission

**Event:** Meta Global AI Developer Hackathon 2026

**Track:** Indie Developer

**Repository:** https://github.com/Walid-Khalfa/testpilot-ai

Supporting documentation:

- `docs/architecture.md`
- `docs/security.md`
- `docs/acceptance.md`
- `docs/demo-script.md`
- `docs/submission.md`
- `docs/submission-checklist.md`
- `docs/modal-billing.md`

The project demonstrates a practical approach to AI-assisted web QA: model-guided exploration, deterministic browser verification, and inspectable execution evidence.

The demonstration is based on controlled local fixtures and historical live Meta inference runs.

## Responsible Use

TestPilot AI is designed for authorized software testing.

Do not use it to test systems without permission, bypass access controls, or access data belonging to others.

The project is an experimental hackathon prototype and should be evaluated within its documented technical and security limitations.