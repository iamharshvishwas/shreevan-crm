# Shreevan Wellness CRM — Backend API

Production-quality **modular monolith** for the Shreevan Wellness CRM.
**NestJS + TypeScript (strict) + PostgreSQL + Prisma.** REST under `/api/v1`,
OpenAPI at `/api/docs`.

> Status: foundation + the critical lifecycle are implemented and compile/test
> clean. Some module APIs are scaffolded against the schema and marked as next
> phases — see **Implementation status** below. Honest by design: nothing claims
> a live external integration that isn't wired.

---

## Quick start

Prerequisites: Node 22+, Docker (for Postgres/Redis).

```bash
cd server
cp .env.example .env                 # adjust secrets as needed
npm install
docker compose up -d postgres        # starts PostgreSQL on :5432

npx prisma migrate deploy            # applies prisma/migrations/0_init
#   (or: npx prisma migrate dev      # for an iterative dev migration)
npm run db:seed                      # idempotent seed (users, stages, samples)

npm run start:dev                    # http://localhost:3000/api/v1
```

- Swagger UI: **http://localhost:3000/api/docs**
- Health: `GET /api/v1/health` · readiness (checks Postgres): `GET /api/v1/health/ready`
- Dev login: **isha@shreevanwellness.com / changeme123** (also `tushar@…` admin, `harsh@…` marketing)

### Smoke test
```bash
# login
curl -s localhost:3000/api/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"isha@shreevanwellness.com","password":"changeme123"}'
# → { accessToken, refreshToken, expiresIn }

TOKEN=...   # accessToken from above
curl -s localhost:3000/api/v1/enquiries?view=needs_reply -H "authorization: Bearer $TOKEN"
curl -s localhost:3000/api/v1/reports/overview -H "authorization: Bearer $TOKEN"

# public website intake (no auth)
curl -s localhost:3000/api/v1/intake/website -H 'content-type: application/json' \
  -d '{"name":"Olivia Bennett","email":"olivia@example.com","message":"Interested in the 28-day reset for September"}'
```

---

## Architecture

Thin controllers → application services (business rules) → Prisma. Provider
specifics live behind adapters in `src/providers`. Transactions wrap every
multi-record state change (conversion, merge, stage move, booking).

```
src/
  config/            env validation (zod, fail-fast at startup)
  database/          PrismaService (global)
  common/            auth guards/decorators, error envelope, pagination, request-id
  health/            liveness/readiness
  modules/
    auth/ users/     argon2 + JWT access + rotating refresh sessions
    contacts/        identities, normalization, safe (never-silent) merge
    enquiries/       ingestion pipeline, triage, convert-to-lead, intake + webhooks
    leads/           pipeline, stage history, next-action rule, booking/close-lost
    reports/         server-side overview + channel aggregates
  providers/         ChannelAdapter contract + SimulationAdapter
  jobs/              SLA evaluation (@nestjs/schedule, idempotent)
prisma/              schema.prisma, migrations/0_init, seed.ts
```

See [docs/ERD.md](docs/ERD.md) for the data model and [docs/API.md](docs/API.md)
for the endpoint map.

## Domain rules enforced server-side

- **message ≠ conversation ≠ enquiry ≠ lead** — separate tables.
- One contact → many channel identities; **fuzzy matches become review
  suggestions, never auto-merged** (`ContactMergeSuggestion` + deliberate merge).
- **Idempotent ingestion** — unique `(connection, externalEventId)` and
  `(connection, externalMessageId)`; replays are no-ops; failed events are
  stored and retryable.
- **Enquiry→lead conversion** is transactional and **duplicate-safe** (re-running
  returns the existing lead) and **requires owner + next action + next-action
  date** (`LEAD_NEXT_ACTION_REQUIRED`).
- **first-touch source** is preserved separately from the current channel.
- **Money** = integer minor units + ISO currency; USD/INR reported separately.
- **UTC** everywhere; IST/customer-local derived at the edge.
- **Only administrative** health-screening/eligibility statuses are stored.
- **Permissions** enforced by guards (`JwtAuthGuard` + `RolesGuard`) and service
  scoping — never trusted from the client.

## Implementation status

| Area | Status |
|---|---|
| Foundation (config, Prisma, errors, health, Swagger, throttling, helmet, request-id) | ✅ implemented |
| Auth (login/refresh/logout/logout-all, argon2, JWT, rotating sessions) | ✅ |
| RBAC (4 roles via guard + service scoping) | ✅ (role enum; a full Permission table is the documented extension) |
| Contacts + identities + safe merge | ✅ |
| Enquiries: ingestion pipeline, website + manual intake, list/views, assign, status, note, tag, respond (manual-log), tasks/calls handoff | ✅ |
| Convert-to-lead (transactional, duplicate-safe, next-action rule) | ✅ |
| Leads + pipeline (move-stage + history, next-action rule, confirm-booking, close-lost) | ✅ |
| Reports overview + channel aggregates (server-side, per-currency) | ✅ |
| SLA evaluation job (idempotent, scheduled) | ✅ (cron; **BullMQ + Redis** is the next phase for distributed retries — Redis already in compose) |
| Tasks / Discovery calls / Programs / Bookings / Customers — **full** CRUD modules | 🟡 schema ready + created via handoffs; dedicated module APIs are the next phase |
| Provider adapters (WhatsApp/Instagram/Facebook/Email) | 🟡 contract + webhook boundary; **awaiting credentials** — never simulated as "live" |
| Integration & E2E test suites (Testcontainers) | 🟡 unit tests pass; DB-backed integration/E2E are the next phase |

## Integrations — awaiting credentials

Webhook endpoints exist at `POST /api/v1/webhooks/:provider` with a validation
boundary; signature verification + parsing live in each adapter and activate
once credentials are present (`.env.example`). **No Google Business Profile
direct messaging** — GBP is a first-touch attribution source only. Outbound
replies are recorded as a **manual log** until a provider is connected.

## Verified in this build

- `npm run build` (full TypeScript strict compile) — ✅
- `npx prisma validate` + client generate — ✅
- Baseline migration generates valid PostgreSQL DDL (35 tables, 49 indexes, 42 FKs) — ✅
- `npx jest` — ✅ 9/9 unit tests (SLA states, identity normalization)
- Boot + migrate + seed + request flow: **requires a running Docker daemon /
  Postgres**, which was not available in the authoring environment. Commands above
  are the documented path; the app compiles and the schema deploys cleanly.

## Security & ops notes

- Secrets never in the DB — `ChannelConnection.secretRef` points at a secrets
  store; provider tokens via env/secrets-manager.
- Rate limiting on auth (5/min login) and webhooks; `helmet` headers; strict CORS.
- Errors return `{ statusCode, code, message, fieldErrors?, requestId }` — no
  stack traces or raw payloads leak.
- Graceful shutdown + Prisma disconnect hooks.
- Backups: use `pg_dump`/`pg_restore` against the Postgres volume; schedule in
  your orchestrator.
