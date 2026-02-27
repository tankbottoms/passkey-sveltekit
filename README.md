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
- Event logging for all auth actions (enrollment, login, logout, failures)
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
  lib/server/
    blob-store.ts    # Vercel Blob persistence (users, credentials, logs)
    session.ts       # HMAC-signed cookie sessions
    store.ts         # In-memory store with Blob sync
    logger.ts        # Event logger -> Blob storage
  routes/
    +page.svelte     # Main passkey UI
    api/auth/        # Registration, login, logout endpoints
    api/credentials/ # Credential management
    api/logs/        # Log viewer API
    logs/            # Log dashboard
```

## License

MIT
