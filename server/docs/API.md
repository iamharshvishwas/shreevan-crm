# API map (`/api/v1`)

Full, live OpenAPI at `/api/docs`. All endpoints require `Authorization: Bearer
<accessToken>` except those marked **public**.

## Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | **public**, rate-limited 5/min → `{ accessToken, refreshToken, expiresIn }` |
| POST | `/auth/refresh` | **public**, rotates the refresh session |
| POST | `/auth/logout` | revoke one refresh session |
| POST | `/auth/logout-all` | revoke all sessions for the user |

## Health (public)
`GET /health` · `GET /health/live` · `GET /health/ready` (checks Postgres)

## Contacts
| Method | Path | Notes |
|---|---|---|
| GET | `/contacts` | search (name/email), filter by country, paginate |
| GET | `/contacts/:id` | with identities, enquiries, leads, customer |
| POST | `/contacts/:id/identities` | add a channel identity (normalized, unique) |
| GET | `/contacts/:id/merge-suggestions` | pending suggestions (never auto-merged) |
| POST | `/contacts/merge-suggestions/:suggestionId/review` | `{ decision: merge \| dismiss }` — transactional + audited |

## Enquiries
| Method | Path | Notes |
|---|---|---|
| GET | `/enquiries?view=` | views: `needs_reply \| unassigned \| waiting_for_customer \| sla_breached \| all` + channel/owner/priority/q |
| GET | `/enquiries/:id` | conversations, messages, notes, tags, computed SLA |
| POST | `/enquiries/:id/assign` | `{ ownerId }` |
| POST | `/enquiries/:id/status` | `{ status }` |
| POST | `/enquiries/:id/notes` | internal note |
| POST | `/enquiries/:id/responses` | logs outbound (manual log unless channel connected) |
| POST | `/enquiries/:id/tasks` | handoff → Task |
| POST | `/enquiries/:id/discovery-calls` | handoff → DiscoveryCall |
| GET | `/enquiries/:id/duplicate-leads` | credible existing leads (review) |
| POST | `/enquiries/:id/convert-to-lead` | transactional, duplicate-safe, requires owner+next action+date |
| POST | `/enquiries/:id/resolve` | mark resolved |

## Intake & webhooks
| Method | Path | Notes |
|---|---|---|
| POST | `/intake/website` | **public**, rate-limited — website form |
| POST | `/enquiries/manual` | manual phone/walk-in (auth) |
| POST | `/enquiries/simulate` | dev-only (`ENABLE_SIMULATION`); 403 in prod |
| POST | `/webhooks/:provider` | **public** boundary; signature verify + parse await credentials |

## Leads & pipeline
| Method | Path | Notes |
|---|---|---|
| GET | `/leads?view=` | views: `active \| hot \| no_next_action \| payment_pending \| closed_lost \| all` |
| GET | `/leads/:id` | stage history, activities, booking |
| POST | `/leads/:id/move-stage` | validates transition; enforces next-action rule for active stages |
| POST | `/leads/:id/next-action` | set owner + next action + date |
| POST | `/leads/:id/confirm-booking` | creates Booking + ConfirmedCustomer |
| POST | `/leads/:id/close-lost` | `{ reasonKey }` |

## Reports
| Method | Path | Notes |
|---|---|---|
| GET | `/reports/overview` | metrics + per-currency expected revenue (server-side) |
| GET | `/reports/channels` | enquiries by channel + conversion-to-lead |

## Error envelope
```json
{ "statusCode": 422, "code": "LEAD_NEXT_ACTION_REQUIRED",
  "message": "Active leads require an owner, next action, and next-action date.",
  "fieldErrors": { "nextActionDate": ["A next-action date is required."] },
  "requestId": "..." }
```
