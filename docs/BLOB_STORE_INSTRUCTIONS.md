# Centralized Blob Store Integration

This project hosts a centralized Vercel Blob storage backend for persisting data across read-only deployed websites. Any site can send structured log data to this service and use it as a lightweight persistence layer.

**Base URL:** `https://passkey-sveltekit.vercel.app` (or your deployed domain)

---

## Setup

### 1. Install the Vercel Blob SDK (if using server-side blob directly)

```bash
npm install @vercel/blob
```

### 2. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BLOB_READ_WRITE_TOKEN` | Yes (auto-injected on Vercel) | Vercel Blob storage token. Injected automatically when blob storage is connected to the Vercel project. |
| `LOG_API_KEY` | Optional | Shared secret for authenticating log ingestion requests. If set, all POST requests to `/api/logs/ingest` must include `Authorization: Bearer {LOG_API_KEY}`. |
| `SESSION_SECRET` | Yes | HMAC secret for session cookies (passkey auth). |

### 3. Connect Blob Storage to Your Vercel Project

1. Go to your Vercel project dashboard
2. Navigate to **Storage** tab
3. Create or connect a **Blob** store
4. The `BLOB_READ_WRITE_TOKEN` environment variable is injected automatically

---

## Blob Storage Structure

```
passkey-store/
  users.json              # Registered users [{id, username}]
  credentials.json        # WebAuthn credentials [{id, userId, publicKey, ...}]

logs/
  {site-id}/
    {YYYY-MM-DD}/
      {timestamp-id}.json # Individual log entries
```

---

## Log Ingestion API

### `POST /api/logs/ingest`

Send log entries from any website or service. Accepts a single entry or an array.

#### Headers

```
Content-Type: application/json
Authorization: Bearer {LOG_API_KEY}    # Required if LOG_API_KEY is set
```

#### Request Body

```json
{
  "site": "my-website",
  "level": "info",
  "message": "User completed checkout",
  "path": "/checkout",
  "userAgent": "Mozilla/5.0 ...",
  "ip": "192.168.1.1",
  "metadata": {
    "orderId": "abc-123",
    "total": 49.99
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `site` | string | Yes | Identifier for the source website (e.g., hostname or project name) |
| `message` | string | Yes | Log message |
| `level` | string | No | `debug`, `info`, `warn`, `error` (default: `info`) |
| `timestamp` | string | No | ISO 8601 timestamp (default: server time) |
| `path` | string | No | URL path where the event occurred |
| `userAgent` | string | No | Browser user agent string |
| `ip` | string | No | Client IP address |
| `metadata` | object | No | Arbitrary key-value data |

#### Batch Ingestion

Send an array of entries in a single request:

```json
[
  {"site": "my-website", "level": "info", "message": "Page loaded", "path": "/"},
  {"site": "my-website", "level": "error", "message": "API call failed", "metadata": {"endpoint": "/api/data"}}
]
```

#### Response

```json
{"ok": true, "count": 2}
```

---

## Integration Examples

### cURL

```bash
curl -X POST https://passkey-sveltekit.vercel.app/api/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_LOG_API_KEY" \
  -d '{"site":"my-app","level":"info","message":"Deploy completed","metadata":{"version":"1.2.0"}}'
```

### SvelteKit (Server-Side)

```typescript
// src/lib/server/remote-logger.ts
const LOG_ENDPOINT = 'https://passkey-sveltekit.vercel.app/api/logs/ingest';
const LOG_API_KEY = process.env.LOG_API_KEY;

export async function remoteLog(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  extra?: { path?: string; metadata?: Record<string, unknown> }
) {
  try {
    await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LOG_API_KEY ? { Authorization: `Bearer ${LOG_API_KEY}` } : {})
      },
      body: JSON.stringify({
        site: 'my-sveltekit-app',
        level,
        message,
        timestamp: new Date().toISOString(),
        ...extra
      })
    });
  } catch {
    console.error(`Remote log failed: ${message}`);
  }
}
```

Usage in a route:

```typescript
// src/routes/api/something/+server.ts
import { remoteLog } from '$lib/server/remote-logger.js';

export const POST = async ({ request }) => {
  // ... handle request ...
  await remoteLog('info', 'Action completed', {
    path: '/api/something',
    metadata: { userId: '123' }
  });
  return new Response('OK');
};
```

### SvelteKit (Client-Side via Form Action)

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
</script>

<form use:enhance action="?/trackEvent" method="POST">
  <input type="hidden" name="event" value="button_click" />
  <button>Click Me</button>
</form>
```

```typescript
// src/routes/+page.server.ts
export const actions = {
  trackEvent: async ({ request }) => {
    const form = await request.formData();
    const event = form.get('event');

    await fetch('https://passkey-sveltekit.vercel.app/api/logs/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        site: 'my-website',
        level: 'info',
        message: `Event: ${event}`,
        timestamp: new Date().toISOString()
      })
    });

    return { tracked: true };
  }
};
```

### Node.js / Bun

```typescript
async function sendLog(message: string, level = 'info', metadata?: Record<string, unknown>) {
  await fetch('https://passkey-sveltekit.vercel.app/api/logs/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_LOG_API_KEY'
    },
    body: JSON.stringify({
      site: 'my-node-service',
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata
    })
  });
}

// Usage
await sendLog('Server started', 'info', { port: 3000 });
await sendLog('Database connection failed', 'error', { host: 'db.example.com' });
```

### Browser (Client-Side Beacon)

```javascript
// Lightweight client-side logging (fire-and-forget)
function logEvent(message, metadata = {}) {
  const payload = JSON.stringify({
    site: window.location.hostname,
    level: 'info',
    message,
    path: window.location.pathname,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    metadata
  });

  // Use sendBeacon for reliability (survives page unload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      'https://passkey-sveltekit.vercel.app/api/logs/ingest',
      new Blob([payload], { type: 'application/json' })
    );
  } else {
    fetch('https://passkey-sveltekit.vercel.app/api/logs/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    });
  }
}

// Usage
logEvent('Page loaded');
logEvent('Button clicked', { buttonId: 'signup' });
```

> Note: The browser example does not include an API key header. `sendBeacon` does not support custom headers. If `LOG_API_KEY` is required, use a server-side proxy or skip auth for client-side logging.

---

## Viewing Logs

### Dashboard

Navigate to `https://passkey-sveltekit.vercel.app/logs` after authenticating with a passkey. The dashboard provides:

- Filtering by site and date
- Color-coded log levels (error, warn, info, debug)
- Reverse-chronological ordering
- Pagination

### API

#### `GET /api/logs`

Requires passkey authentication (session cookie).

| Param | Type | Description |
|-------|------|-------------|
| `site` | string | Filter by site identifier |
| `date` | string | Filter by date (`YYYY-MM-DD`) |
| `limit` | number | Max entries to return (default: 50) |
| `cursor` | string | Pagination cursor from previous response |

```bash
curl -b "passkey_session=..." \
  "https://passkey-sveltekit.vercel.app/api/logs?site=my-website&limit=20"
```

Response:

```json
{
  "entries": [
    {
      "id": "1740000000000-abc123",
      "site": "my-website",
      "level": "info",
      "message": "Page loaded",
      "timestamp": "2026-02-26T00:00:00.000Z",
      "path": "/",
      "metadata": {}
    }
  ],
  "sites": ["my-website", "my-other-app"],
  "cursor": "...",
  "hasMore": false
}
```

---

## Using Blob Storage Directly

For projects that need to store arbitrary data (not just logs), use the `@vercel/blob` SDK directly with the shared store.

### Writing Data

```typescript
import { put } from '@vercel/blob';

const { url } = await put('my-app/config.json', JSON.stringify({ theme: 'dark' }), {
  access: 'public',
  addRandomSuffix: false,
  contentType: 'application/json'
});
```

### Reading Data

```typescript
import { list } from '@vercel/blob';

const result = await list({ prefix: 'my-app/config.json' });
if (result.blobs.length > 0) {
  const response = await fetch(result.blobs[0].url);
  const config = await response.json();
}
```

### Listing Data

```typescript
import { list } from '@vercel/blob';

const result = await list({ prefix: 'my-app/', limit: 100 });
for (const blob of result.blobs) {
  console.log(blob.pathname, blob.size, blob.uploadedAt);
}
```

### Deleting Data

```typescript
import { del } from '@vercel/blob';

await del('https://your-store.public.blob.vercel-storage.com/my-app/old-file.json');
```

> All direct blob operations require `BLOB_READ_WRITE_TOKEN` to be set. This is only available server-side.

---

## Path Convention

When using the shared blob store from multiple projects, namespace your data by site/project to avoid collisions:

```
{project-name}/
  {data-type}/
    {filename}.json
```

Examples:

```
portfolio-site/users.json
portfolio-site/analytics/2026-02-26.json
blog/drafts/my-post.json
api-service/cache/rates.json
```
