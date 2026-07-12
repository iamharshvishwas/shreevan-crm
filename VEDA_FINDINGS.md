# VEDA_FINDINGS.md

Source of truth for the Veda audit run per VEDA_AUDIT_LOOP.md. Started 2026-07-12.

## Phase 0 — Baseline (2026-07-12)

- Postgres (shreevan_pg) + Redis up, 15 migrations applied, seed idempotent-clean.
- Typecheck: server CLEAN, frontend CLEAN. Jest: 13/13 pass. Boot: 0 errors.
- Branch: `feature/per-user-screen-access` (8 commits ahead, unpushed).
- Local limits: no OPENAI_API_KEY, no live WhatsApp/SMTP — AI-path claims are
  data-layer verified only; anything needing live keys is marked NEEDS-RAILWAY.

## Phase 1 — Findings

### P1 (workflow broken / wrong data)

**V-E1 · Status drift: Live-Chat replies (Veda's AND staff's) never update the
enquiry — false SLA breaches + inflated "needs reply" badge** — STATUS: CLOSED (441820d)
- Post-fix: staff reply → WAITING_FOR_CUSTOMER + firstRespondedAt set; backdated
  2h → SLA cron fired NO breach. Veda-reply leg sets firstRespondedAt only
  (status stays NEEDS_REPLY by design) — same code path, NEEDS-RAILWAY for a
  live-AI confirmation.
- Files: `server/src/modules/veda/channels/chat.controller.ts:190-217`
  (agentReply — creates the OUTBOUND message but never touches the enquiry),
  `server/src/modules/veda/agents/veda-chat.service.ts:104-120` (same),
  `server/src/jobs/sla.scheduler.ts:21-24` (breaches anything with
  `firstRespondedAt: null`), `server/src/modules/enquiries/enquiries.service.ts`
  (listSlaBreached excludes WEBSITE_CHAT but the scheduler does not — inconsistent).
- Repro (verified locally): visitor chat → staff replied via
  `POST /chat/conversations/:id/reply` → `enquiry.status = NEEDS_REPLY`,
  `firstRespondedAt = null`. Backdated 2h → SLA cron fired
  `SlaEvents: ["BREACH"]` + notification `SLA breached` on an
  **already-answered** chat.
- Impact: sidebar badge over-counts (Harsh's screenshot showed 229), false SLA
  alarms, first-response metrics in Reports wrong for every live-chat enquiry.
- Minimal fix: on agentReply → set `firstRespondedAt ??= now`, status →
  WAITING_FOR_CUSTOMER (same as enquiries.service.reply does). On Veda's
  respond() → set `firstRespondedAt ??= now` only (status stays NEEDS_REPLY —
  a human still hasn't seen it), and make sla.scheduler skip enquiries whose
  conversation Veda answered, OR align scheduler with listSlaBreached by
  excluding WEBSITE_CHAT. Decide exact semantics with Harsh.

**V-B1 · Phone numbers stored in two formats → duplicate contacts + undeliverable
WhatsApp sends** — STATUS: CLOSED (e3ebf06)
- Post-fix: two-format repro yields ONE contact, single identity
  +918755548877. Jest 14/14 incl. new canonicalization cases. Existing
  bare-format Railway rows keep their handle (harmless; new messages link
  canonically).
- Files: `server/src/modules/contacts/identity.util.ts:7-8` (normalizePhone
  keeps "8755548899" as-is; no +91 canonicalization), `:26` (regex is
  India-specific so intent is a 10-digit Indian mobile).
- Repro (verified): same person, message text "8755548899" then form
  "+91 87555 48899" → identities `["8755548899","+918755548899"]` → **2
  separate contacts**. Cross-session linking broken.
- Second impact: approval payload `to: "8755548899"` — Meta Cloud API requires
  country code → the send Naina-style visitors asked for would fail even after
  staff approval. (Send failure is NEEDS-RAILWAY to observe live; the dup
  contacts are proven locally.)
- Minimal fix: canonicalize bare 10-digit Indian mobiles (starting 6-9) to
  `+91XXXXXXXXXX` inside normalizePhone; one-off data note for existing rows.

**V-C1 · `dailyMessageLimit` (50/day) is dead config — no send cap enforced
anywhere** — STATUS: CLOSED (d09c9b5)
- Post-fix: limit=1 + 2 APPROVED emails → exactly 1 sent, 1 deferred (stayed
  APPROVED); raising limit released it next tick. PATCH /veda/config
  {dailyMessageLimit:77} persists.
- Files: `server/src/modules/veda/veda-config.service.ts:12` (default), `:48`
  (update() can't even change it); `grep -rn dailyMessageLimit src` → zero
  consumers.
- Impact: with SEND_EMAIL/SEND_WHATSAPP autoApprove ON, a runaway loop
  (nurture + qualifier chain) has no daily ceiling — cost + spam risk. The
  config UI implies a safety net that does not exist.
- Minimal fix: executor checks count of today's EMAIL_SENT/WHATSAPP_SENT
  COMPLETED logs before sending; skip + log when over limit.

### P2 (misleading / quality)

**V-C2 · Quiet hours only apply to voice calls — email/WhatsApp send at 3am**
— STATUS: CLOSED (86a7e07). Quiet window over "now" → approved email held;
window moved → sent next tick.
- Files: `veda-executor.service.ts` run() (no quiet-hours check);
  `veda-voice-scheduler.service.ts:58` (only consumer of inQuietHours).
- Minimal fix: same inQuietHours guard at the top of executor run().

**V-C3 · WhatsApp greeting template greets the guest by their PHONE NUMBER**
— STATUS: CLOSED (6c08fd9). Simulated provider log shows template parameters
[{"type":"text","text":"Naina…}] for name "Naina Singh" (was the phone).
- File: `veda-executor.service.ts` sendWhatsApp() out-of-window branch:
  `const firstName = payload.to;` → template `{{1}}` = "918755548866".
  Payload (both drafters) has no name field.
- Minimal fix: include contact name in drafter payload; fall back to "there".
- NEEDS-RAILWAY to observe live; code-level certain.

**V-G1 · Public chat endpoint has no payload limits**
— STATUS: CLOSED (8d11dcd). 3000-char message → 400; normal → 201; 5000-char
TTS → 400; short TTS → 204.
- Files: `veda/dto/veda.dto.ts` ChatMessageDto (message/name/email/phone/
  sessionId all unbounded), `chat.controller.ts:49` (TTS text unbounded too).
- Repro (verified): 78KB message → HTTP 201. Each Veda turn would ship the
  whole history (16 msgs) to OpenAI → cost abuse within the 30/min throttle.
- Minimal fix: @MaxLength on DTO fields (message ~2000, name/email/phone ~120,
  sessionId ~80; TTS text ~600).

**V-A2 · Fallback reply shown to the visitor is never recorded in the
conversation** — STATUS: CLOSED (dada29b)
- Deeper than recorded: the widget never renders the POST reply at all (poll-only),
  so visitors saw SILENCE when Veda was off. Fallback now persisted as
  OUTBOUND/Veda (poll renders it) + conversation flagged needsAttention.
- File: `chat.controller.ts:18,90,101` — FALLBACK_REPLY returned to the widget
  but not persisted; staff see a conversation with no answer while the visitor
  was told "our team will get back to you very shortly".
- Repro (verified): messages recorded = INBOUND only (before staff reply).
- Minimal fix: persist the fallback as an OUTBOUND authorName 'Veda' message
  when it is actually shown.

### P3 (minor) — later also approved; all CLOSED (2026-07-13)

**V-B2 · detectProgram false positives** — STATUS: CLOSED (8f325fd)
- Post-fix: "I am 60 years old" → null; "the 28 day program" → 28-Day Personal
  Reset; phone digits (9814600028) → null. Verified via live chat ingestion.
- `ingestion.service.ts:289-295`:
"I am 60 years old" → "60-Day Integration Masterclass"; any "28"/"14"/"60" in
numbers/dates/phones matches. Minimal fix: require day-context
(`/\b(60|28|14)[- ]?day/`) or program-name keywords.

**V-D1 · Staff assistant task tools silently drop non-lead links** — STATUS: CLOSED (803a65a)
- Post-fix: create_task for a non-lead contact links contactId and reports
  linkedTo="contact (not a lead yet)" (verified via standalone-context
  invocation of the tool executor). set_lead_next_action/move_lead_stage
  already returned explicit errors — unchanged.
- `command.service.ts` create_task/set_lead_next_action/move_lead_stage resolve
names via findLeadByName (active LEADS only). "Naina ke liye task banao" for a
chat-visitor → task created with no link, no warning. Minimal fix: fall back to
contact match → link contactId; or tell the user it isn't linked.

**V-B3 · Contact created outside the ingestion transaction** — STATUS: CLOSED (b2eeec3)
- Pre-fix repro: bad-occurredAt ingest → orphan contact (0 enquiries/convos).
- Post-fix: same ingest → rollback, NO contact row; happy path unchanged
  (processed, enquiry + conversation created).
- Was: `ingestion.service.ts` resolveContact() ran before $transaction.

### Verified-OK (no finding)

- Approval expiry cron runs every minute regardless of enablement ✓
- Executor dedup (COMPLETED log skip, ≤3 attempts) ✓; only APPROVED picked ✓
- Kill switch gates chat, executor, schedulers, nurture ✓
- Handover silences Veda; "Hand back to Veda" exists in LiveChat UI ✓
- Manual staff reply captures self-learning answers ✓; gap dedup (jaccard) ✓;
  sensitive categories force human approval ✓; APPLIED can't re-apply ✓
- Ingestion idempotency (unique connection+externalMessageId) ✓
- Meta leadgen idempotent via `leadgen:<id>` ✓
- Chat context: known email/phone + programs + KB injected into prompt ✓
- Unassigned-enquiry notifications broadcast (userId null → visible to all) ✓

## Phase 2 — decision (2026-07-13)

Harsh approved fixing everything per the default: all P1 + P2 fixed; P3
deferred.

## Phase 4 — regression (2026-07-13)

- Jest 14/14, typecheck clean both sides, production builds clean, boot clean.
- Combined live repro on the fixed server: staff Live-Chat reply →
  WAITING_FOR_CUSTOMER + firstRespondedAt SET; phone "8755548833" in message
  text stored as +918755548833 (single contact); fallback recorded as
  OUTBOUND/Veda; find_person-class lookup resolves name/email/phone/enquiry.
- C1/C2/C3 individually verified during their fixes (cap defer/release,
  quiet-hours hold/release, template name param).
- DB restored to baseline (7 contacts, 1 user); all test artifacts removed.

### NEEDS-RAILWAY (post-deploy, needs live keys)
1. Veda AI reply on web chat sets firstRespondedAt (V-E1 second leg).
2. A real WhatsApp template send delivers with the guest's first name (V-C3)
   and to a +91-canonical number (V-B1).

## Final status (2026-07-13)

All 10 findings CLOSED (7 P1/P2 + 3 P3). Final regression: jest 14/14,
typecheck clean both sides, combined live spot-check (program detection +
phone canonicalization + fallback recording) passed, DB at baseline
(7 contacts, 1 user). 12 commits on `feature/per-user-screen-access`
pending push (10 fixes incl. find_person, + docs).
