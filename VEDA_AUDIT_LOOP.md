# VEDA_AUDIT_LOOP.md — v1.0

Loop-engineering framework to audit the **Veda AI Agent** end-to-end: find errors,
gaps, workflow bugs and broken handoffs; propose the smallest correct fix; then
implement fixes one at a time with verified evidence.

**Scope = Veda only.** The agent surfaces listed in the Surface Map below, plus the
ingestion/enquiry seams Veda writes into. Nothing else.

---

## Mission

1. **UNDERSTAND** — trace how Veda actually behaves across every channel and role.
2. **FIND** — locate real, reproducible problems (not style opinions).
3. **FIX** — one finding at a time, minimal diff, verified before claiming done.

## Ground rules (non-negotiable)

- **No unnecessary code.** Every changed line must map to a numbered finding.
  Before each commit run the Scope Gate (below). No refactors, no renames, no
  formatting churn, no drive-by cleanups, no new dependencies, no new features
  that aren't the direct minimal fix for a finding.
- **Evidence before assertion.** A finding is only a finding with: `file:line` +
  a local reproduction (curl / script / DB query). A fix is only "done" with a
  before/after repro showing the behavior changed.
- **Honest verification limits.** Local env has NO `OPENAI_API_KEY` and NO live
  WhatsApp/SMTP credentials. AI-path changes are verified at the data/tool layer
  (exact DB queries, prompt content inspection, simulated providers). Anything
  that truly needs a live key is marked **"needs Railway verification"** — never
  claimed as live-tested.
- **Do not touch:** JWT payload/secrets, 2FA flow, RBAC guards, Prisma migrations
  (unless a finding literally requires a schema change — then ask first).
- **One commit per finding**, message format: `fix(veda): <finding-id> <summary>`.
- Findings live in `VEDA_FINDINGS.md` (create at repo root, keep updated as the
  single source of truth).

## Setup

```bash
cd server && docker compose up -d          # Postgres (shreevan_pg) + Redis
npx prisma migrate deploy && npm run db:seed
npm run start:dev                          # API on :3000 (login: harsh@shreevanwellness.com / changeme123)
```

- Simulated providers are the default locally (`ENABLE_SIMULATION=true`, no
  provider keys) — email/WhatsApp "sends" are recorded, not delivered. That is
  enough to verify pipeline correctness.
- Public chat endpoint (no auth): `POST /api/v1/chat/message`
  `{ sessionId, name, message }` — this is how you simulate a website visitor.
- Staff endpoints need a Bearer token from `POST /api/v1/auth/login`.

## Surface map (audit territory)

| Area | Files (server/src/modules/…) |
|---|---|
| Visitor chat brain (web + WhatsApp replies) | `veda/agents/veda-chat.service.ts` |
| Staff voice/command assistant | `veda/agents/command.service.ts` |
| Drafters (outbound email/WA for leads) | `veda/agents/email-drafter.service.ts`, `veda/agents/whatsapp-drafter.service.ts` |
| Lead qualifier | `veda/agents/lead-qualifier.service.ts` |
| Channels in | `veda/channels/chat.controller.ts`, `whatsapp.service.ts`, `email-inbound.service.ts`, `lead-intake.service.ts` |
| Providers out | `veda/channels/whatsapp.provider.ts`, `voice.provider.ts`, `veda/ai/email.provider.ts` |
| Approval → execute pipeline | `veda/veda-approval.service.ts`, `veda-executor.service.ts` (cron 30s) |
| Schedulers / nurture | `veda-scheduler.service.ts`, `veda-voice-scheduler.service.ts`, `nurture/nurture.service.ts` |
| Config / kill switch / logs | `veda-config.service.ts`, `veda-log.service.ts` |
| Knowledge (RAG) + self-learning gaps | `VedaKnowledge`, `VedaKnowledgeGap` models + their services |
| Seams Veda writes into | `enquiries/ingestion.service.ts`, `enquiries/enquiries.service.ts`, `enquiries/conversion.service.ts` |
| Frontend consoles | `src/screens/Veda.tsx`, `src/screens/LiveChat.tsx`, `src/components/VedaMic.tsx` |

## Bug-class taxonomy (what "a Veda bug" looks like)

Calibration — real bugs already found in this codebase. Hunt for **more of the
same classes**, and re-verify the fixed ones still hold:

1. **Context amnesia** — Veda re-asked a visitor for name/phone/email that the
   pre-chat form + conversation already contained. (Found & fixed: contact
   details now injected into the chat prompt. Re-verify.)
2. **Invisible workflow / dead-end data** — web-chat enquiries existed in the DB
   but were filtered out of the Enquiries tab, so staff could never see or
   convert them; info captured in chat went nowhere. (Found & fixed. Re-verify.)
3. **Assistant blind spot** — staff assistant's only lookup tool was
   `search_leads`, so any non-lead person ("who is Naina?") was invisible.
   (Found & fixed with `find_person`. Re-verify.)
4. **Status drift** — Veda's auto-reply does NOT flip enquiry status to
   `WAITING_FOR_CUSTOMER` the way a staff reply does, so the "needs reply" badge
   over-counts conversations Veda already answered. (KNOWN OPEN — verify current
   state, record as a finding if still true.)
5. **Capability lies** — Veda tells visitors "I can't send details on
   WhatsApp/email" while a real outbound pipeline exists (drafter → approval →
   executor) but is only wired to Leads, never triggerable from a visitor chat.
   (Decision on file: visitor-request sends must go through draft + staff
   approval, NOT auto-send. Verify what exists; record the gap precisely.)

## Audit lenses (run ALL, in order)

- **A. Conversation correctness** — for web chat AND WhatsApp: does `respond()`
  see contact identities, prior messages, program data, knowledge base? Does it
  hallucinate capabilities? Does handover-to-human actually silence Veda? Does
  `needsAttention` fire when it should?
- **B. Data handoff** — everything a visitor tells Veda (name/email/phone/
  program interest) must land on Contact/ContactIdentity/Enquiry. Trace each
  extraction path; find fields that are parsed but never persisted, or persisted
  but never shown in any tab.
- **C. Action pipeline** — approval lifecycle: PENDING → APPROVED → executor →
  AUTO_SENT / FAILED (retries ≤3) / EXPIRED. Check: expiry cron actually runs;
  rejected/expired approvals can't execute; executor dedup holds; 24h-window
  logic (template vs free-form) is right; kill switch stops everything.
- **D. Staff assistant tools** — each of the 7 tools: correct data, correct
  filters, no injection via names, sane behavior when the person isn't a lead
  (e.g. `create_task` silently dropping the link).
- **E. State machines** — EnquiryStatus, SlaState, VedaApprovalStatus,
  VedaGapStatus, NurtureStatus: find transitions that can strand a record
  forever or double-fire.
- **F. Knowledge & self-learning** — RAG retrieval with and without embeddings
  (keyword fallback); gap capture → answer → APPLIED loop; can a gap be applied
  twice; is sensitive content gated PENDING as designed.
- **G. Config, cost & safety** — graceful degradation with no OpenAI key; cost
  logging accuracy; `ENABLE_SIMULATION` guardrails; public endpoint abuse
  (chat endpoint rate limiting / payload size); health-data policy (prompts must
  keep forbidding medical info; transcripts redacted).

## The loop

```
PHASE 0  Baseline: clean boot, typecheck, jest, seed DB. Record in VEDA_FINDINGS.md.

PHASE 1  For each lens A→G:
         1. READ the code paths fully (no skimming).
         2. EXERCISE them locally (curl the real endpoints; write throwaway
            scripts in scratch, never committed).
         3. RECORD findings: ID (V-A1, V-B2, …), severity (P0 data-loss/wrong-send,
            P1 workflow-broken, P2 misleading-UX, P3 minor), file:line, repro,
            root cause, minimal-fix sketch.
         Do NOT fix anything during Phase 1.

PHASE 2  Present ALL findings ranked to Harsh in Hinglish. WAIT for approval on
         which ones to fix (default: all P0+P1 if he says "sab thik karo").

PHASE 3  Fix loop — for each approved finding, in severity order:
         1. Re-run the repro (still broken?).
         2. Smallest possible diff.
         3. Scope Gate (below).
         4. Verify: repro now passes + typecheck + jest + clean boot.
         5. Commit (one finding = one commit). Update VEDA_FINDINGS.md status.

PHASE 4  Regression: re-run every Phase-1 repro (fixed AND already-passing ones),
         full typecheck/jest/build both sides. Final Hinglish report: what was
         found, what changed, what needs Railway verification, what was left.
```

## Scope Gate (run before EVERY commit)

- [ ] Every changed hunk maps to exactly one finding ID.
- [ ] `git diff --stat` — no file outside that finding's blast radius.
- [ ] No formatting-only hunks, no renamed symbols, no moved code.
- [ ] No new dependencies, no schema changes (unless pre-approved).
- [ ] Comment density matches surrounding code; comments state constraints, not narration.
- [ ] Repro script output pasted into VEDA_FINDINGS.md under the finding.

## Definition of done (whole loop)

- VEDA_FINDINGS.md: every finding CLOSED (fixed + verified), DEFERRED (with
  Harsh's sign-off), or NEEDS-RAILWAY (exact post-deploy test steps written).
- All commits on the feature branch, each mapping 1:1 to findings.
- Zero unrelated diff anywhere (`git diff main --stat` reviewed).
- Final report delivered in Hinglish, ranked by user impact.
