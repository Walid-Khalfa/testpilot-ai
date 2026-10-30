# Hackathon Submission Checklist

## Repository
- [ ] Public GitHub repo: https://github.com/Walid-Khalfa/testpilot-ai
- [ ] README.md complete and accurate
- [ ] LICENSE (MIT) — pending your approval
- [ ] No secrets committed (`.env.local`, `.data/` ignored)
- [ ] Commit SHA to submit: (latest on main)

## Demo video (3–5 min)
- [ ] Follow `docs/demo-script.md`
- [ ] Show: project creation, spec upload, Meta planning, Playwright execution, finding, report
- [ ] Use defective fixture for confirmed finding
- [ ] Use success fixture for no-false-positive
- [ ] Mention model name: Meta Muse Spark Open (Modal dedicated endpoint)

## Hackathon portal submission
- [ ] Project name: TestPilot AI
- [ ] Track: Indie Developer — "Push the Frontier"
- [ ] Description from `docs/submission.md`
- [ ] Link to GitHub repo
- [ ] Link to demo video
- [ ] Tech stack: Next.js 16, TypeScript, Playwright, Zod, Meta Muse Spark Open via Modal
- [ ] Screenshots: dashboard, run timeline, finding, report

## Verification commands (run before recording)
```bash
npm run typecheck
npm run lint
npm run test
npm run build:webpack
npm run dev:local
```

## Launch & reset
- Launch: `npm run dev:local`
- Reset: delete `.data/`, restart dev server, clear browser cache.
- Use synthetic data only. Stop Modal endpoint when not demoing.