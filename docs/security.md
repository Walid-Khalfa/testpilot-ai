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
- API routes are unauthenticated in the MVP; deploy behind an authenticated gateway/reverse proxy before public exposure
- Requirements API (`/api/requirements`) is restricted to localhost (host + origin header checks) for local development only; use `npm run dev:local` to bind exclusively to 127.0.0.1
- The API is not authenticated; do not expose publicly. Cross-origin browser requests are blocked by the absence of CORS headers plus the origin check.
- Synchronous execution endpoint may exceed serverless request timeouts for long runs; use bounded limits or async polling in production