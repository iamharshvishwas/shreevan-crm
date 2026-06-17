# Enquiries — implementation notes

The **Enquiries** module: a focused, multi-channel enquiry workspace inside the
Shreevan CRM, built against `/Users/harshvishwas/Downloads/design.md` and the
existing app architecture.

> **Naming.** "Enquiries" is the user-facing module (sidebar, screen, route key
> `enquiries`). The internal services folder stays `src/inbox/` and the core
> domain entities remain `Conversation` / `Message` — valid technical names,
> intentionally *not* renamed to "Lead". It originally shipped as an "Inbox" tab
> and was refactored into the narrower **Enquiries** module: five primary views
> (Needs reply · Unassigned · Waiting for customer · SLA breached · All
> enquiries), with channel/owner/priority/relationship/program and resolved/spam
> moved under **More filters**. Tasks, discovery calls, payments, confirmed
> customers, integrations and reports are owned by their own modules and reached
> from Enquiries via contextual handoffs only. `Simulate inbound` is dev-only
> (`import.meta.env.DEV`) and absent from production builds.

## ⚠️ Architecture reality (read first)

This repository is a **client-side React + TypeScript + Vite prototype with
in-memory state** (`useAppStore` = React `useState`). There is **no backend,
database, auth, or message queue** — `design.md` §9 says as much: *"lift the
data model into your API and replace the in-memory arrays."*

The CO-STAR brief asked for production infrastructure (Postgres migrations,
webhook signature verification, provider SDK adapters, server-side permissions
and aggregation, dead-letter queues). **Those cannot be real production code in a
front-end-only SPA.** Rather than fake a backend or claim unverified
integrations work, the Inbox is implemented at the **same fidelity as the rest
of this app**, with the production concerns expressed as **clean boundaries +
documented next steps**:

| Brief asked for | What ships here | To make it real |
|---|---|---|
| DB schema + migrations | Typed domain model (`src/inbox/types.ts`), separate entities, in-memory store | Map types → tables; add migrations + FKs/uniques |
| Webhook ingestion + signature verify | `ingest()` pipeline (validate → dedup → normalize → resolve → upsert → route + SLA), idempotent & retry-safe; `ChannelAdapter.parseWebhook` boundary | Implement adapters server-side; verify provider signatures |
| Provider SDK adapters | `ChannelAdapter` contract + `simulationAdapter`; channels flagged `simulated` / `not_configured` | Implement per-provider adapters behind the contract |
| Server-side permissions | Roles modeled (Settings) and enforced in UI | Enforce in API/RLS |
| Server-side aggregation | Reports computed client-side from in-memory data | Move aggregation to API |

Nothing here claims a live provider connection. Outbound "replies" are recorded
as a **manual log** (`delivery: 'logged'`), never as delivered messages.

## Domain model (`src/inbox/types.ts`)

Deliberately separate from `Lead`:

```
Contact ─┬─ ContactIdentity[]   (one per channel handle)
         ├─ Conversation[]      (many, across channels)
         └─ leadId?             (link to a qualified Lead)

Conversation ─┬─ Message[]      (inbound / outbound / internal)
              ├─ InternalNote[] · tags[] · AssignmentEntry[] · AuditEntry[]
              ├─ status · priority · owner · SLA · nextAction
              └─ leadId?

ChannelConnection · SlaPolicy · RoutingRule · MergeSuggestion · InboundEventRecord
```

Rules enforced in the prototype:

- **A message ≠ a conversation ≠ a lead.** Conversations can exist with no lead.
- **One contact, many channel identities.** Resolution links only on an exact
  channel handle / verified email / normalized phone. Anything fuzzier becomes a
  **MergeSuggestion** (confidence + evidence) shown in the context panel and at
  convert time — **never auto-merged**. Merges are deliberate (`mergeContacts`).
- **Lead conversion** (`convertConversationToLead`) requires **owner + next
  action + next-action date**, preserves first-touch source, and links the
  conversation ↔ lead.
- **Money** is `{ amountMinor, currency }`; USD and INR are never summed.
- **Time** is persisted UTC; the UI renders **IST first**, then the contact's
  local zone (`istFirst()`).
- **Health**: only administrative screening / eligibility statuses — no medical
  detail (a seeded note nudges staff to advise a screening call).

## Ingestion pipeline (`src/inbox/logic.ts → ingest()`)

```
validate → persist InboundEventRecord → dedup (by externalMessageId, idempotent)
→ resolve/create contact → upsert conversation + message → route owner + pick SLA
```

- **Idempotent**: replaying the same `externalMessageId` is recorded as
  `duplicate` and changes nothing. The "Simulate inbound" button proves this by
  sending the same event twice.
- **Retry-safe**: failed events are stored with an error and can be reprocessed
  (`retryFailedEvent`).
- Pure functions — unit-testable and reusable from a future API handler.

## Channel adapter contract

```ts
interface ChannelAdapter {
  channel: Channel;
  isLive(): boolean;
  parseWebhook(raw, connection): NormalizedInboundEvent | null; // + signature verify
  sendReply(conv, text): Promise<{ delivery, detail }>;
}
```

Only `simulationAdapter` exists in the prototype (`isLive() === false`). The
normalized inbound-event shape (`NormalizedInboundEvent`) matches the handoff
JSON exactly, so a backend can emit it unchanged.

**Google Business Profile:** there is intentionally **no direct GBP chat**
integration (GBP messaging isn't generally available). GBP is modeled only as a
first-touch *attribution* source on tracked website / phone / WhatsApp / email
actions.

## What works end-to-end (in the prototype)

- Inbox nav tab (after Overview) with an **actionable** badge (needs first
  response · waiting on us · SLA breached · unassigned).
- Three-pane workspace: **queue · conversation · contact/lead context**;
  responsive (context hides ≤1200px, single-region ≤820px).
- 13 smart queues / saved views with live counts; channel/owner/status/search
  filters compose within a view.
- Open a conversation, assign owner, change status, tag, add internal note,
  **log a reply**, create a linked follow-up task, link to an existing lead,
  **convert to a new qualified lead** (with duplicate detection).
- Merge-suggestion review (confidence + evidence), explicit merge.
- "Simulate inbound" demonstrates the idempotent pipeline.
- Integration: Overview snapshot, Topbar global search + notifications, Reports
  channel section, Settings (channels / SLA / routing), Lead-profile linked
  conversations.

## Awaiting credentials / backend (next phase)

| Channel | State | Needs |
|---|---|---|
| Website form | working (fixtures) | POST endpoint `/api/inbound/website` |
| Phone / walk-in | working (manual) | — |
| WhatsApp Business | simulated · token-expiring demo | Meta WABA token + webhook + signature verify |
| Instagram | simulated | Meta app review + page token |
| Facebook Messenger | not configured | Meta page token |
| Email | simulated | IMAP / Microsoft Graph credentials |
| Website chat | not configured | a chat provider |

See `.env.example` for the variables a backend implementation would read.
