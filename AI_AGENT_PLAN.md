# Shreevan CRM — AI Automation Agent: Architecture & Build Plan

> Goal: a **fully automated lead-to-booking pipeline** (any lead source) **+** a
> **voice-controlled CRM** for the operator. Every step runs automatically, with
> safety rails (consent, opt-out, quiet hours, spend caps, human kill-switch).

---

## 1. The end-to-end flow

```
   ANY SOURCE                     ┌─────────────────────────────────────────┐
 Meta/IG/FB Ads ─┐                │           AI ORCHESTRATOR                │
 Website form  ──┤                │   (NestJS + BullMQ queue + GPT)       │
 WhatsApp in   ──┼─► INBOUND ────►│                                          │
 Email in      ──┤    GATEWAY     │  1. Qualify lead (GPT extracts need)  │
 Manual entry  ──┘  (normalize →  │  2. Auto-WhatsApp (template + AI fill)   │
                     1 Lead)      │  3. Client confirms slot (WA buttons)    │
                                  │  4. AI Voice Agent calls at slot time    │
                                  │  5. Record + transcribe → redact → CRM   │
                                  │  6. AI drafts + sends email              │
                                  └─────────────────────────────────────────┘
                                                   │
   OPERATOR ──► 🎤 Voice Command ──► GPT (tools = CRM API) ──► does the action
```

Key idea: **lead source doesn't matter.** Everything flows through one
**Inbound Gateway** that creates a normalized `Lead`. A `lead.created` event then
drives the same automation pipeline for every lead.

---

## 2. Components

| # | Component | Responsibility |
|---|-----------|----------------|
| A | **Inbound Gateway** | Receive Meta-lead / website / WhatsApp / email / IG-FB events, dedupe, create one normalized Lead. (Backend already has stubs for `/api/inbound/*`.) |
| B | **AI Orchestrator** | Event-driven workflow engine. On `lead.created`, runs the pipeline as a series of **queued jobs** with retries + idempotency. |
| C | **Qualifier (GPT)** | Reads ad form / message → extracts structured requirement (program, dates, budget signal, country, language, urgency) → writes to Lead → routes owner. |
| D | **WhatsApp Engine** | Sends approved template messages (AI fills variables in client's language), handles inbound replies + interactive slot buttons. |
| E | **Scheduler** | On slot confirmation → creates a Discovery Call in CRM → enqueues a **delayed job** to trigger the voice call at the chosen time. |
| F | **Voice Agent** | At slot time, triggers the voice-AI platform to call the client with lead context + script; plays a recording-consent line; records the call. |
| G | **Post-call Processor** | On call-end webhook: pull recording + transcript + AI summary → **redact health detail** → attach to Lead + Discovery Call in CRM. |
| H | **Email Engine** | GPT drafts a personalized email from requirement + call outcome → sends via email provider (optional human-approval gate). |
| I | **Voice Command Agent** | Operator speaks in the CRM UI → speech-to-text → GPT with the CRM API as tools → performs the action + replies. |
| J | **Automation Console** | A CRM screen showing each lead's journey timeline, what the AI did, costs, and a **kill-switch / approval queue**. |

---

## 3. Recommended tech / provider stack

| Need | Recommended | Why |
|------|-------------|-----|
| Orchestration / jobs | **NestJS + BullMQ + Redis** | Fits current stack; Redis already in docker-compose. Reliable retries, delayed jobs, idempotency. |
| AI brain | **OpenAI API** (GPT-4o-mini for routine, GPT-4o / latest for hard) via a swappable `AIProvider` layer | You already have an OpenAI key. Handles tool-calling, classification, drafting, redaction. Swappable to other LLM providers later. |
| WhatsApp | **Meta WhatsApp Cloud API** (cheapest) **or** Indian BSP (AiSensy / Interakt / Gupshup) | BSP = easier template approval + India support; Cloud API = lowest cost. |
| Voice AI call | **Vapi** or **Retell AI** | Managed STT+LLM+TTS+telephony+recording+transcript+webhooks — avoids building real-time audio. |
| Telephony number | **Plivo / Exotel** (India) via the voice platform | India outbound needs DLT/TRAI compliance. |
| Operator voice command | **Web Speech API** (v1, free, in browser) → **Deepgram/Whisper** later | Free to start, upgrade for accuracy. |
| Email | **Resend** (simple) or **AWS SES** (cheap at scale) | Reliable transactional email. |
| Transcription (fallback) | **Deepgram / Whisper** | If the voice platform's transcript isn't enough. |

---

## 4. How it plugs into the existing CRM

New backend modules: `inbound-gateway`, `automation` (orchestrator + jobs),
`messaging` (WhatsApp + email), `voice` (call trigger + webhooks).

New Prisma models (sketch):
- `LeadJourney` — pipeline state per lead (which step, status, timestamps).
- `OutboundMessage` — every WhatsApp/email sent (channel, template, status, cost).
- `VoiceCallSession` — recording URL ref, transcript ref, AI summary, outcome, **consentGiven** flag.
- `ProviderEvent` — raw inbound provider events (idempotency / replay).
- `ConsentRecord` — WhatsApp opt-in, call-recording consent.
- `AutomationConfig` — per-step on/off, quiet hours, daily caps, approval-required flags.

Reuses existing: `Contact`, `Lead`, `DiscoveryCall`, `AuditLog`, `Notification`,
`ChannelConnection` (already modeled, currently simulated).

---

## 5. Cross-cutting (non-negotiable)

- **Reliability:** every step is an idempotent queued job; failed steps retry with
  backoff; provider events deduped by external id.
- **Secrets:** all provider keys in env / secrets store — **never in the DB**.
- **Privacy / health data:** call transcripts may contain medical detail. Our rule
  is *administrative statuses only* — so transcripts are **redacted by GPT**
  before storage; raw recordings are access-controlled and consent-gated.
- **Consent & compliance (India):**
  - WhatsApp: opt-in required; business-initiated needs **approved templates**.
  - Voice: **DLT/TRAI registration**, recording-consent line at call start, and
    **quiet hours** (no calls late night / early morning).
  - Meta Lead Ads: **app review** for `leads_retrieval`.
- **Guardrails:** global kill-switch, per-day send/call caps, per-lead spend cap,
  opt-out handling (STOP), and an optional **human-approval queue** for first
  message / first call until you trust it.
- **Auditability:** every automated action written to `AuditLog`.
- **Cost tracking:** each message/call logs its cost; dashboard shows spend.

---

## 6. What YOU must procure (I can't create these)

1. **OpenAI API key** — for the AI brain. *(You already have this ✓)*
2. **Meta Business** account + Facebook Page + App, with **lead-ads** and
   **WhatsApp** permissions (app review).
3. **WhatsApp BSP** account (or Meta Cloud API) + approved message templates.
4. **Voice AI platform** account (Vapi/Retell) + a **telephony number** (with India DLT).
5. **Email provider** account (Resend/SES) + verified sending domain.
6. A **monthly budget** (these are pay-per-use: WhatsApp per-conversation, voice per-minute, GPT per-token).

---

## 7. Phased roadmap (each phase ships independently)

**Phase 0 — Foundation (no external accounts needed)**
- BullMQ + Redis worker, event bus, job framework, provider abstraction layer,
  `AutomationConfig` + kill-switch, audit hooks, Automation Console (read-only).

**Phase 1 — Cheap, high-value, mostly software**
- Operator **Voice Command Agent** (Web Speech API + GPT tools over CRM API).
- AI **Lead Qualifier** (auto-extract requirement on every new lead).
- **Auto Email** (GPT-drafted, provider send) with approval gate.

**Phase 2 — WhatsApp**
- Inbound Gateway for Meta Lead Ads (real, after app review).
- Auto-WhatsApp (templates + AI fill) + interactive **slot scheduling**.

**Phase 3 — Voice (most advanced + regulated)**
- AI Voice Agent outbound call (Vapi/Retell) at scheduled slot.
- Post-call: recording + transcript + summary → **redact** → CRM.

---

## 8. Locked decisions (v1)

1. **Voice language:** Hindi **+** English, **auto-detect** per client. → Phase 3
   voice platform must be multilingual (Vapi/Retell support this).
2. **WhatsApp:** **Meta WhatsApp Cloud API** (direct). Lowest per-message cost; you
   own the Meta app + template approval.
3. **Automation level:** **human-approval-first.** The Automation Console has an
   **Approval Queue** — AI proposes the first WhatsApp / email / call, you approve;
   once trusted, flip each step to full-auto. → Build the approval queue + per-step
   auto/approve toggle from Phase 0/1, not later.
4. **Budget:** not fixed yet → **build cheapest-first.** Phase 1 (voice command +
   qualifier + email) needs only GPT API + email (low cost). Phase 2 (WhatsApp)
   and Phase 3 (voice calls) begin once a budget is set.

**Phase 1 prerequisite from you:** an **OpenAI API key** — you already have it ✓.

---

*Status: PLAN ONLY. Nothing here is built or connected yet. Integrations are
marked as future work and must not be assumed live until credentials + provider
setup + testing are done.*
