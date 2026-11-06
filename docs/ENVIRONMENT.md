# NIVA Environment Configuration Reference

This document provides a comprehensive specification of all environment variables used across NIVA services (`@niva/web`, `@niva/api`, and `niva-ai`).

> **Security Rule**: Never commit `.env` or files containing real secrets to version control. Use `.env.example` as a template for local development and `.env.production.example` for production environments.

---

## 1. Runtime & Server Ports

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | `development` | Runtime mode: `development`, `test`, or `production`. Controls logging verbosity and security enforcement. |
| `PORT` | Number | `4000` | Port for the NestJS API server. |
| `API_PORT` | Number | `4000` | Alias for NestJS API server port. |
| `WEB_PORT` | Number | `3000` | Port for the Next.js web application. |
| `AI_PORT` | Number | `8000` | Port for the Python FastAPI intelligence service. |
| `LOG_LEVEL` | String | `debug` | Logging level: `debug`, `info`, `warn`, `error`. |

---

## 2. Database & Vector Storage (PostgreSQL 16)

| Variable | Type | Example / Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | String | `postgresql://user:pass@localhost:5432/niva_db?schema=public` | PostgreSQL connection string. Must point to a database with `pgvector` enabled. In production, append `?sslmode=require`. |
| `DB_POOL_MIN` | Number | `5` | Minimum connection pool size. |
| `DB_POOL_MAX` | Number | `20` | Maximum connection pool size for NestJS database pool. |
| `DB_IDLE_TIMEOUT_MS`| Number | `30000` | Milliseconds before idle connection is closed. |

---

## 3. Distributed Cache & Coordination (Redis 7.2)

| Variable | Type | Example / Default | Description |
| :--- | :--- | :--- | :--- |
| `REDIS_URL` | String | `redis://localhost:6379` | Redis connection URL. For managed cloud Redis with TLS, use `rediss://`. |
| `REDIS_TLS_ENABLED` | Boolean | `false` | Set to `true` when connecting to TLS-enabled Redis instances. |

---

## 4. Application Security & Cryptographic Keys

Generate 64-character cryptographically secure keys using:
```bash
openssl rand -hex 32
```

| Variable | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `JWT_SECRET` | String | Min 32 chars | Secret key used to sign and verify JSON Web Tokens. |
| `JWT_EXPIRES_IN` | String | `15m` | Lifetime of authentication access tokens. |
| `REFRESH_TOKEN_EXPIRES_IN` | String | `30d` | Lifetime of long-lived refresh tokens stored in database sessions. |
| `COOKIE_SECRET` | String | Min 32 chars | Secret used for cookie signature and session validation. |
| `INTERNAL_SERVICE_SECRET` | String | Min 32 chars | Shared secret exchanged between NestJS API and FastAPI AI service via `X-Niva-Internal-Secret`. Must match on both services. |

---

## 5. AI Service & Provider Configuration

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `AI_SERVICE_URL` | String | `http://localhost:8000` | URL of the internal Python FastAPI service accessed by NestJS. |
| `GEMINI_API_KEY` | String | Required | Google Gemini API key obtained from Google AI Studio. |
| `DEFAULT_AI_PROVIDER` | String | `gemini` | Primary AI provider abstraction. |
| `AI_MODEL_NAME` | String | `gemini-3.1-flash-lite` | Default LLM model for conversational turn generation. |
| `AI_EMBEDDING_MODEL_NAME` | String | `gemini-embedding-001` | Model used for generating 768-dimensional memory embeddings. |
| `AI_QUOTA_COOLDOWN_SECONDS` | Number | `60` | Cooldown duration before resetting backoff counters upon HTTP 429 quota exhaustion. |

---

## 6. WebPush Notifications (VAPID)

| Variable | Type | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | String | P-256 base64-url encoded public key consumed by frontend Service Worker subscription. |
| `VAPID_PUBLIC_KEY` | String | Base64-url encoded public key for API push dispatch. |
| `VAPID_PRIVATE_KEY` | String | Base64-url encoded private key for WebPush payload signing. |
| `VAPID_SUBJECT` | String | Contact email for push service (`mailto:admin@example.com`). |

---

## 7. Outbound Email & OAuth (Optional Integrations)

| Variable | Type | Description |
| :--- | :--- | :--- |
| `SMTP_HOST` | String | Outbound SMTP server host (e.g. `smtp.gmail.com`). |
| `SMTP_PORT` | Number | SMTP port (`587` for STARTTLS, `465` for SSL). |
| `SMTP_USER` | String | Outbound email username or Google App Email. |
| `SMTP_PASS` | String | SMTP account password or 16-character Google App Password. |
| `RESEND_API_KEY` | String | Alternative email provider key (Resend REST API). |
| `GOOGLE_CLIENT_ID` | String | Google OAuth 2.0 Web Client ID. |
| `GOOGLE_CLIENT_SECRET` | String | Google OAuth 2.0 Client Secret. |
| `GOOGLE_CALLBACK_URL` | String | OAuth redirect URI (`http://localhost:4000/api/v1/auth/google/callback`). |
