<div align="center">

# ⚙️ Credify — Backend

**Express + TypeScript REST API with PostgreSQL**

[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Jest](https://img.shields.io/badge/Jest-29-C21325?logo=jest&logoColor=white)](https://jestjs.io/)

</div>

---

## Overview

The backend handles all off-chain operations: wallet-based authentication, user profiles, social connections, posts/feed, and IPFS file management. It exposes a RESTful API consumed by the Next.js frontend, with JWT-based session management after initial wallet signature verification.

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| PostgreSQL | ≥ 14 |
| npm | ≥ 9 |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up PostgreSQL

```bash
createdb blockchain_social
```

Or configure a custom database with environment variables:

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `blockchain_social` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |
| `JWT_SECRET` | `dev-secret` | Secret for signing JWTs |
| `PORT` | `3001` | Server port |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |

### 3. Run the server

```bash
npm run dev        # Development (ts-node)
npm run build      # Compile TypeScript
npm start          # Production (compiled JS)
```

Migrations run automatically on startup. The server starts on **http://localhost:3001**.

---

## API Endpoints

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/nonce` | — | Generate nonce for wallet address |
| `POST` | `/api/auth/verify` | — | Verify signature, return JWT |

### Profiles

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/profiles` | JWT | Create profile |
| `GET` | `/api/profiles/:address` | JWT | Get profile by wallet address |
| `PUT` | `/api/profiles/:address` | JWT | Update own profile |
| `POST` | `/api/profiles/:address/image` | JWT | Upload profile image to IPFS |

### Connections

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/connections/request` | JWT | Send connection request |
| `PUT` | `/api/connections/:id/accept` | JWT | Accept request |
| `PUT` | `/api/connections/:id/decline` | JWT | Decline request |
| `GET` | `/api/connections` | JWT | List connections (paginated) |

### Posts & Feed

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/posts` | JWT | Create a post (max 5000 chars) |
| `DELETE` | `/api/posts/:id` | JWT | Delete own post |
| `GET` | `/api/feed` | JWT | Paginated reverse-chronological feed |

### IPFS

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ipfs/upload` | JWT | Upload file (JPEG, PNG, PDF) |
| `GET` | `/api/ipfs/:cid` | JWT | Retrieve file by CID |

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                  # Express app entry point
│   ├── config/
│   │   ├── database.ts               # PostgreSQL connection pool
│   │   └── contracts.ts              # Reads shared-config.json
│   ├── middleware/
│   │   ├── auth.ts                   # JWT verification
│   │   ├── cors.ts                   # CORS policy
│   │   ├── errorHandler.ts           # Global error handler
│   │   ├── rateLimiter.ts            # Sliding window rate limiter
│   │   ├── sanitize.ts               # XSS input sanitization
│   │   └── validate.ts               # Zod schema validation
│   ├── routes/                   # Express route definitions
│   ├── services/                 # Business logic
│   │   ├── authService.ts
│   │   ├── profileService.ts
│   │   ├── connectionService.ts
│   │   ├── postService.ts
│   │   └── ipfsService.ts
│   ├── repositories/             # PostgreSQL data access (parameterized queries)
│   ├── migrations/               # Database schema & indexes
│   ├── validators/               # Zod request schemas
│   └── types/                    # TypeScript type definitions
├── __tests__/                    # Jest test suites
│   ├── properties/                   # fast-check property-based tests
│   └── middleware/                   # Middleware unit tests
├── jest.config.ts
├── tsconfig.json
└── package.json
```

---

## Middleware Stack

Requests flow through middleware in this order:

```
CORS → JSON Parser → Sanitize → [Rate Limiter on /auth] → Route Handler → Error Handler
                                        │
                              JWT Auth (protected routes)
                              Zod Validation (request bodies)
```

| Middleware | Purpose |
|---|---|
| **CORS** | Restricts to `FRONTEND_ORIGIN` |
| **Sanitize** | Strips HTML/script tags from all string inputs |
| **Rate Limiter** | Sliding window on `/api/auth/*` endpoints |
| **JWT Auth** | Verifies `Authorization: Bearer <token>`, attaches `req.user` |
| **Validate** | Zod schema validation, returns 400 with error details |
| **Error Handler** | Catches unhandled errors, returns generic 500 (no stack traces) |

---

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

Tests use **Jest** with **supertest** for API integration tests and **fast-check** for property-based testing of auth, validation, and data integrity.

---

## Error Response Format

All errors follow a consistent structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Display name must be 100 characters or fewer",
    "details": {}
  }
}
```

| Code | Status | When |
|---|---|---|
| `AUTH_INVALID_TOKEN` | 401 | Invalid/expired JWT |
| `AUTH_SIGNATURE_MISMATCH` | 401 | Signature doesn't match address |
| `FORBIDDEN` | 403 | Accessing another user's resource |
| `VALIDATION_ERROR` | 400 | Request body fails schema |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many auth requests |
| `DUPLICATE_CONNECTION` | 409 | Connection already exists |
| `INTERNAL_ERROR` | 500 | Unhandled server error |
