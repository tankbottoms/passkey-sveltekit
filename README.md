# Passkey Gate

Passwordless authentication using WebAuthn passkeys, built with SvelteKit. Supports deployment to both Vercel and Cloudflare Workers.

**Live:**
- Cloudflare: https://passkey-sveltekit.atsignhandle.workers.dev
- Vercel: https://passkey-sveltekit.vercel.app

## Features

- Passkey enrollment and authentication via WebAuthn
- Cross-platform support (Touch ID, Face ID, Windows Hello, security keys)
- Stateless session management (HMAC-signed cookies)
- Centralized credential and log storage via Vercel Blob
- Server-side request logging (all page/API requests)
- Client-side event telemetry (page views, auth flows, interactions)
- Log viewer dashboard at `/logs` with client event badges and device info
- Dual deployment: Vercel + Cloudflare Workers from the same codebase

## Quick Start

```bash
npm install
npm run dev
```

Visit `https://localhost:5173` (HTTPS required for WebAuthn).

## Architecture

```
Browser (WebAuthn)
    |
SvelteKit App (Vercel or Cloudflare Workers)
    |
Vercel Blob Store (users, credentials, logs)
```

Both deployments share the same Vercel Blob backend. Passkeys enrolled on one deployment work on the other (when using the same domain).

## Deployment

### Vercel

Vercel auto-detects the SvelteKit adapter. Set these environment variables in the Vercel dashboard:

- `BLOB_READ_WRITE_TOKEN` -- auto-linked when you create a Blob store
- `SESSION_SECRET` -- production session signing secret

```bash
npm run build   # adapter-auto detects Vercel
```

### Cloudflare Workers

Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in your shell environment.

```bash
CF_PAGES=1 npm run build
npx wrangler deploy
```

Or use the convenience script:

```bash
npm run deploy:cloudflare
```

Set secrets once (they persist across deploys):

```bash
echo "token" | npx wrangler secret put BLOB_READ_WRITE_TOKEN
echo "secret" | npx wrangler secret put SESSION_SECRET
```

See [docs/CLOUDFLARE_SETUP.md](docs/CLOUDFLARE_SETUP.md) for full setup instructions.

### How Dual Deployment Works

| Concern | Vercel | Cloudflare |
|---------|--------|------------|
| Adapter | `adapter-auto` detects `VERCEL=1` | `adapter-auto` detects `CF_PAGES=1` |
| Runtime | Node.js | Workers with `nodejs_compat` v2 |
| Env vars | `process.env` natively | `platform.env` bridged to `process.env` in hooks |
| Config | N/A | `wrangler.toml` |
| Secrets | Dashboard env vars | `npx wrangler secret put` |

## Project Structure

```
src/
  lib/
    event-logger.ts    # Client-side event tracker (session ID, UA parsing, buffered flush)
    server/
      blob-store.ts    # Vercel Blob persistence (users, credentials, logs)
      session.ts       # HMAC-signed cookie sessions
      store.ts         # In-memory store with Blob sync
      logger.ts        # Server-side request logger -> Blob storage
  routes/
    +layout.svelte     # Nav, theme, event logger init
    +page.svelte       # Main passkey UI with event tracking
    api/auth/          # Registration, login, logout endpoints
    api/credentials/   # Credential management
    api/events/        # Client-side event ingest endpoint
    api/logs/          # Log viewer API
    logs/              # Log dashboard with client event badges
```

## Client-Side Event Telemetry

The app tracks user interactions client-side and posts them to `/api/events`, which writes to the same Vercel Blob log store used by server-side request logging.

**Tracked events:** `page_view`, `auth_click`, `auth_success`, `auth_error`, `enroll_gate_unlock`, `enroll_click`, `enroll_success`, `enroll_error`, `logout`, `credential_delete`

**Device context:** Browser, OS, device type, screen size, language (parsed from User-Agent)

**Buffering:** Events queue in memory, flush every 10 seconds or on page hide via `navigator.sendBeacon`. Failures are silently dropped.

Client events appear in the `/logs` viewer with a `[CLIENT]` badge and device info.

## License

MIT
