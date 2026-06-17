# Data model (ERD)

Core relationships (full schema in `prisma/schema.prisma`; 35 tables total).

```mermaid
erDiagram
  User ||--o{ RefreshSession : has
  User ||--o{ Enquiry : owns
  User ||--o{ Lead : owns

  Contact ||--o{ ContactIdentity : "has (1 per channel handle)"
  Contact ||--o{ Conversation : has
  Contact ||--o{ Enquiry : has
  Contact ||--o{ Lead : has
  Contact ||--o| ConfirmedCustomer : becomes
  ContactMergeSuggestion }o--|| Contact : "A (review only)"
  ContactMergeSuggestion }o--|| Contact : "B (never auto-merge)"

  ChannelConnection ||--o{ InboundEvent : receives
  ChannelConnection ||--o{ Conversation : carries
  Enquiry ||--o{ Conversation : groups
  Conversation ||--o{ Message : contains
  Message ||--o{ MessageAttachment : has

  Enquiry ||--o{ EnquiryTag : tagged
  Enquiry ||--o{ InternalNote : notes
  Enquiry ||--o{ EnquiryAssignmentHistory : history
  Enquiry ||--o{ SlaEvent : sla
  Enquiry }o--o| SlaPolicy : "evaluated by"
  Enquiry ||--o| Lead : "converts to (1:1, optional)"

  PipelineStage ||--o{ Lead : stages
  Lead ||--o{ LeadStageHistory : history
  Lead ||--o{ LeadActivity : timeline
  Lead ||--o| Booking : confirms
  Lead }o--o| LeadLostReason : "lost via"
  Booking ||--o| ConfirmedCustomer : handoff
  Program ||--o{ ProgramCohort : cohorts
  ProgramCohort ||--o{ Booking : books

  Enquiry ||--o{ Task : "spawns (handoff)"
  Enquiry ||--o{ DiscoveryCall : "spawns (handoff)"
```

## Lifecycle

```
Inbound message ──(InboundEvent, idempotent)──▶ Conversation + Message
        │
        ▼
     Enquiry  ──(convert, transactional, requires owner+next-action+date)──▶ Lead
        │                                                                      │
   triage/route/SLA                                              pipeline stages (10)
                                                                               │
                                                              confirm-booking ─▶ Booking ─▶ ConfirmedCustomer
```

## Key invariants (DB-level)

- `ContactIdentity (channel, normalizedHandle)` unique → safe auto-link only.
- `InboundEvent (connectionId, externalEventId)` and `(connectionId, externalMessageId)` unique → idempotent ingestion.
- `Enquiry.leadId` unique → an enquiry maps to at most one lead.
- `SlaEvent (enquiryId, type)` unique → idempotent SLA escalations.
- `Booking.leadId` / `ConfirmedCustomer.bookingId` unique → one booking per lead.
- Money: `expectedValueAmount` (Int, minor units) + `expectedValueCurrency` (enum) — never combined across currencies.
- All `DateTime` are UTC.
