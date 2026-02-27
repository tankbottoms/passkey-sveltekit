# Cloudflare Workers Setup

Deploy the passkey-sveltekit app to Cloudflare Workers alongside the existing Vercel deployment.

## Architecture

```
Cloudflare Workers (.workers.dev)  -->  Vercel Blob (storage backend)
Vercel (vercel.app)                -->  Vercel Blob (storage backend)
```

Both deployments share the same Vercel Blob store. No data migration needed.

## 1. Get Cloudflare Credentials

### API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use the "Edit Cloudflare Workers" template
4. Copy the token

### Account ID

Found in two places:
- Cloudflare dashboard right sidebar under "Account ID"
- In the URL: `dash.cloudflare.com/{account-id}/...`

### Set Environment Variables

Add to `~/.shellenv` (or `~/.zshrc`):

```bash
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="your-account-id-here"
```

## 2. Deploy

### Build and Deploy

```bash
source ~/.shellenv
CF_PAGES=1 npm run build
npx wrangler deploy
```

Or use the Claude Code skill:

```
/cloudflare-deploy
```

The live URL is: `https://passkey-sveltekit.juicebox.workers.dev`

### How it Works

- `CF_PAGES=1` makes `adapter-auto` use `adapter-cloudflare`
- `wrangler.toml` configures the Worker with `nodejs_compat` v2 and Static Assets
- `npx wrangler deploy` bundles `_worker.js` + static assets and deploys

## 3. Set Secrets (Once)

Secrets persist across deploys. Set them once via CLI:

```bash
echo "YOUR_BLOB_TOKEN" | npx wrangler secret put BLOB_READ_WRITE_TOKEN
echo "YOUR_SESSION_SECRET" | npx wrangler secret put SESSION_SECRET
```

| Secret | Source | Required |
|--------|--------|----------|
| `BLOB_READ_WRITE_TOKEN` | Vercel dashboard > Storage > Blob store > Tokens | Yes |
| `SESSION_SECRET` | `openssl rand -base64 32` or your own | Yes |

## 4. Custom Domain (Optional)

1. Go to Workers & Pages > passkey-sveltekit > Triggers > Custom Domains
2. Add your domain
3. Cloudflare handles DNS and SSL automatically

## 5. Verify

After deploying:

- [ ] Visit `https://passkey-sveltekit.juicebox.workers.dev`
- [ ] Test passkey enrollment
- [ ] Test passkey login
- [ ] Check /logs dashboard
- [ ] Verify Vercel deployment still works

## Troubleshooting

**`process is not defined`**: Ensure `wrangler.toml` has `compatibility_date = "2024-09-23"` or later with `compatibility_flags = ["nodejs_compat"]`.

**Blob storage errors**: Verify `BLOB_READ_WRITE_TOKEN` secret is set via `npx wrangler secret list`.

**`_worker.js` uploaded as asset**: Ensure `static/.assetsignore` contains `_worker.js`.

**adapter-auto not detecting Cloudflare**: Set `CF_PAGES=1` before build, and ensure `@sveltejs/adapter-cloudflare` is a devDependency.
