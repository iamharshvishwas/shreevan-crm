# Shreevan Wellness — CRM & Lead Tracker

A high-fidelity, interactive implementation of the internal CRM and lead-tracker
dashboard for **Shreevan Wellness**, built from the Claude Design handoff bundle
(`Shreevan CRM.dc.html`). Recreated as a real React + TypeScript + Vite app,
faithful to the Shreevan Wellness Design System ("Sacred Forest, Flowing River,
Clear Mind").

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## What's inside

A single-page app with a collapsible forest-green sidebar, global search,
notifications, quick-add lead, and ten navigable screens:

- **Enquiries** — focused multi-channel enquiry workspace (Instagram, WhatsApp,
  Facebook, email, website forms, phone/walk-in). Three-pane list · conversation
  · context; **five** primary views (Needs reply, Unassigned, Waiting for
  customer, SLA breached, All enquiries) with everything else under **More
  filters**; SLA, assignment, internal notes, and safe enquiry→lead conversion.
  Other workflows (tasks, calls, payments, customers, integrations) live in their
  own modules and are reached via contextual handoffs. See **[ENQUIRIES.md](ENQUIRIES.md)**
  for the design, domain model, ingestion pipeline, and what's simulated vs. needs
  a backend.
- **Overview** — greeting, date-range filter, six metric cards (revenue card
  inverted forest), today's priority actions, leads requiring attention
  (no-next-action + overdue, amber-flagged), recent enquiries, upcoming calls,
  pipeline summary, lead-source bars, conversion funnel, activity timeline.
- **Booking pipeline** — all 10 stages, **drag-and-drop** between columns, with
  per-column lead count + expected revenue. Click a card to open the lead.
- **Leads** — live search, 8 saved views, stage/owner filters, sortable columns,
  bulk-action bar, no-next-action rows tinted, empty state with "clear filters".
- **Lead profile** — header with stage/temp/owner + actions (log call, move
  stage, mark confirmed/lost), a next-action banner that flips to a warning when
  none is set, contact/program/administrative-status cards (screening statuses
  only — no medical data), and 7 tabs incl. working notes.
- **Tasks & follow-ups** — Today/Overdue/Upcoming/Completed tabs with live
  counts, list + June calendar views, overdue rows flagged.
- **Discovery calls** — upcoming call cards with dual time zones and prep notes,
  plus a recently-completed log.
- **Programs**, **Reports** (source-quality table, country donut, program &
  lost-reason bars, monthly trend, expected-vs-confirmed revenue — all
  custom-drawn), **Confirmed customers** (onboarding statuses), **Settings**
  (team, notification prefs, pipeline-stage order, health-data policy callout).

Plus: global search dropdown, notifications panel, quick-add lead modal (with
validation), and success toasts.

## Project structure

```
src/
  main.tsx            entry
  App.tsx             shell + screen router
  store.ts            useAppStore() — all app state & actions
  types.ts            domain types
  data.ts             sample leads/tasks, stages, design-token maps
  styles/
    tokens.css        Shreevan Wellness design tokens (colors, type, spacing)
    app.css           globals + hover utilities
  components/         Sidebar, Topbar, AddLeadModal, Toast, icons, ui primitives
  screens/            Overview, Pipeline, Leads, LeadProfile, Tasks, Calls,
                      Programs, Reports, Customers, Settings
```

## Design fidelity notes

- **Tokens** are lifted verbatim from the design system (`--sw-forest-900`,
  `--sw-sand-050`, `--sw-mist-100`, etc.); type is Lora (headings) + Inter (UI).
- **Status is never colour-only** — every stage/temperature/priority pill pairs
  a dot with text.
- **Mixed currency** — USD for international leads, INR for Indian leads.
- **No medical data** — only administrative screening/eligibility statuses are
  stored, per the brief.
- As in the prototype, headline metrics and charts use fixed sample figures
  (adding a lead updates the lists, not the headline counts); Columns/Export are
  illustrative and surface a toast.
