# PROMPT.md — SvelteKit 2 + SimpleWebAuthn Passkey Authentication

## Project Overview

Build a **fully self-contained passkey authentication system** using SvelteKit 2 and SimpleWebAuthn. No external authentication services (Firebase, Auth0, etc.). The implementation should be production-ready, secure, and deployable via Docker.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | SvelteKit 2 (latest stable) |
| Runtime | Node.js 20+ or Bun |
| WebAuthn Server | `@simplewebauthn/server` |
| WebAuthn Client | `@simplewebauthn/browser` |
| Database | SQLite (via `better-sqlite3`) for simplicity; Postgres-ready schema |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS 4 |
| Sessions | Secure HTTP-only cookies (no JWT) |

---

## Core Features

### 1. Passkey Registration Flow
- User provides email/username
- Server generates registration challenge (`generateRegistrationOptions`)
- Browser calls `navigator.credentials.create()` via SimpleWebAuthn
- Server verifies attestation (`verifyRegistrationResponse`)
- Store credential: `credentialID`, `publicKey`, `counter`, `transports`

### 2. Passkey Authentication Flow
- User initiates login (email or discoverable/resident key)
- Server generates authentication challenge (`generateAuthenticationOptions`)
- Browser calls `navigator.credentials.get()` via SimpleWebAuthn
- Server verifies assertion (`verifyAuthenticationResponse`)
- Create session, set secure cookie

### 3. Session Management
- HTTP-only, Secure, SameSite=Strict cookies
- Session stored server-side (SQLite table)
- CSRF protection via SvelteKit's built-in mechanisms
- Session expiry and refresh logic

### 4. Multi-Device Support
- Users can register multiple passkeys
- List registered credentials in account settings
- Revoke/delete individual credentials

---

## Database Schema (Drizzle)
```typescript
// src/lib/server/db/schema.ts

users
  - id: text (primary key, nanoid)
  - email: text (unique, not null)
  - createdAt: integer (unix timestamp)

credentials
  - id: text (primary key, base64url credentialID)
  - userId: text (foreign key → users.id)
  - publicKey: blob (not null)
  - counter: integer (default 0)
  - transports: text (JSON array, nullable)
  - createdAt: integer (unix timestamp)
  - lastUsedAt: integer (nullable)

sessions
  - id: text (primary key, nanoid)
  - userId: text (foreign key → users.id)
  - expiresAt: integer (unix timestamp)
  - createdAt: integer (unix timestamp)
```

---

## Project Structure
```
├── src/
│   ├── lib/
│   │   ├── server/
│   │   │   ├── db/
│   │   │   │   ├── index.ts         # DB connection
│   │   │   │   └── schema.ts        # Drizzle schema
│   │   │   ├── auth/
│   │   │   │   ├── webauthn.ts      # SimpleWebAuthn helpers
│   │   │   │   ├── session.ts       # Session management
│   │   │   │   └── constants.ts     # RP ID, origin, etc.
│   │   │   └── index.ts
│   │   └── components/
│   │       └── PasskeyButton.svelte
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── +layout.server.ts        # Load session for all routes
│   │   ├── +page.svelte             # Home
│   │   ├── auth/
│   │   │   ├── register/
│   │   │   │   ├── +page.svelte
│   │   │   │   └── +server.ts       # POST: generate options
│   │   │   ├── register/verify/
│   │   │   │   └── +server.ts       # POST: verify attestation
│   │   │   ├── login/
│   │   │   │   ├── +page.svelte
│   │   │   │   └── +server.ts       # POST: generate options
│   │   │   ├── login/verify/
│   │   │   │   └── +server.ts       # POST: verify assertion
│   │   │   └── logout/
│   │   │       └── +server.ts       # POST: destroy session
│   │   └── account/
│   │       ├── +page.svelte         # Protected: manage credentials
│   │       └── +page.server.ts      # Load user credentials
│   └── hooks.server.ts              # Session validation middleware
├── drizzle/
│   └── migrations/
├── static/
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts
├── svelte.config.js
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/register` | Generate registration options |
| POST | `/auth/register/verify` | Verify attestation, create user + credential |
| POST | `/auth/login` | Generate authentication options |
| POST | `/auth/login/verify` | Verify assertion, create session |
| POST | `/auth/logout` | Destroy session |
| GET | `/account` | Protected page, list credentials |
| DELETE | `/account/credentials/[id]` | Revoke a credential |

---

## Security Requirements

1. **Relying Party (RP) Configuration**
   - `rpID`: Derive from `PUBLIC_ORIGIN` env var (e.g., `localhost` for dev)
   - `rpName`: Application name
   - `origin`: Full origin including protocol

2. **Challenge Storage**
   - Store challenges server-side (session or short-lived DB entry)
   - Challenges expire after 60 seconds
   - Delete challenge after use (one-time)

3. **Credential Verification**
   - Validate `counter` is greater than stored value (prevent replay)
   - Update `counter` and `lastUsedAt` on successful auth

4. **Session Cookies**
```typescript
   {
     httpOnly: true,
     secure: true, // false in dev
     sameSite: 'strict',
     path: '/',
     maxAge: 60 * 60 * 24 * 7 // 7 days
   }
```

---

## Environment Variables
```env
# .env
PUBLIC_ORIGIN=http://localhost:5173
DATABASE_URL=./data/app.db
SESSION_SECRET=<random-32-bytes-hex>
```

---

## Docker Configuration
```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PUBLIC_ORIGIN=https://yourdomain.com
      - DATABASE_URL=/data/app.db
      - SESSION_SECRET=${SESSION_SECRET}
    volumes:
      - app_data:/data

volumes:
  app_data:
```
```dockerfile
# Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "build"]
```

---

## Implementation Notes

1. **Discoverable Credentials (Resident Keys)**
   - Set `residentKey: 'preferred'` in registration options
   - Allows usernameless login via `allowCredentials: []`

2. **User Verification**
   - Set `userVerification: 'preferred'` (biometric/PIN when available)

3. **Attestation**
   - Use `attestationType: 'none'` unless you need device attestation

4. **Error Handling**
   - Return user-friendly errors for WebAuthn failures
   - Log detailed errors server-side

5. **TypeScript**
   - Use strict mode
   - Properly type all WebAuthn responses

---

## Commands to Run
```bash
# Initialize project
npm create svelte@latest passkey-auth
cd passkey-auth

# Install dependencies
npm install @simplewebauthn/server @simplewebauthn/browser
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3
npm install -D tailwindcss @tailwindcss/vite

# Generate migrations
npx drizzle-kit generate

# Run migrations
npx drizzle-kit push

# Dev server
npm run dev

# Build for production
npm run build
```

---

## Deliverables

1. Complete, working SvelteKit 2 application
2. All files listed in project structure
3. Database migrations
4. Docker configuration
5. README.md with setup instructions

---

## Quality Checklist

- [ ] TypeScript strict mode, no `any` types
- [ ] All routes properly protected
- [ ] Sessions invalidated on logout
- [ ] Counter validation prevents replay attacks
- [ ] Works on localhost without HTTPS (for development)
- [ ] Mobile-responsive UI
- [ ] Accessible (ARIA labels on auth buttons)
- [ ] No console errors or warnings
