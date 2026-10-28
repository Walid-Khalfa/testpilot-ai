# Security

## Implemented

- Explicit authorization confirmation at project creation
- Domain allowlisting and host matching
- URL normalization and scheme restriction (http/https only)
- DNS resolution with blocking of private, loopback, link-local, and metadata addresses (SSRF protection)
- Localhost blocked unless ALLOW_LOCAL_DEMO=true
- Redirect validation against the allowed domain
- Browser network egress restricted to the authorized origin
- Bounded execution: max steps, duration, pages, token budget, concurrency
- No arbitrary JavaScript execution; model output validated with Zod
- No model access to OS, secrets, shell, or infrastructure credentials
- Secrets only via environment variables; `.env*` gitignored

## Limitations (MVP)

- No user authentication or multi-tenant isolation
- File-based storage is not encrypted at rest
- Egress filtering is best-effort at the Playwright context level
- Local demo mode weakens SSRF protection and must remain disabled in production