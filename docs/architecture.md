# Architecture

End-to-end AI-assisted SDR workflow with three phases.

---

## Phase 1: Lead Qualification

**Runtime**: n8n workflow automation

Source signals are ingested, scored for relevance, and filtered through a multi-stage qualification pipeline:

1. **Source signal ingestion** — Configurable source adapters collect market signals (public content engagement data)
2. **Content scoring** (Claude, 3-axis 1-10) — Technical depth + industry insight + product relevance
3. **Eligibility screening** (Claude, binary) — 2-gate filter: target industry affiliation + competitor exclusion
4. **Profile scoring** (Claude, 3-axis 1-10) — Role relevance + industry fit + seniority & influence
5. **Interest profiling** (GPT-4o-mini) — Summarize professional interests from content engagement for downstream personalization

**Output**: Qualified, scored, interest-profiled contacts in CRM database.

> See [lead-discovery.md](lead-discovery.md) for detailed workflow documentation.

---

## Phase 2: Message Generation

**Runtime**: Python + Anthropic Claude API

Three orchestration skills manage the pipeline:

1. **Lead selection** — Query CRM + campaign history, classify accounts, rank candidates, recommend top leads
2. **Message generation** — Async parallel LLM calls (10 concurrent) with knowledge base injection. Produces 6 personalized messages per lead across email and messaging channels.
3. **Campaign assignment** — Link generated messages to campaign platform, assign team member, update workflow state

**Output**: 6 messages per lead stored in PostgreSQL, ready for human review.

---

## Phase 3: Operations Dashboard

**Runtime**: Next.js + React + Prisma + Neon PostgreSQL

Web dashboard for sales managers to review, edit, approve, and launch AI-generated outreach:

- **Campaign analysis** — Per-campaign view with status cards and lead tables
- **Message review** — Inline editing with apply/discard workflow
- **One-click launch** — Batch-select and launch leads to campaign platform
- **Profile analysis** — Cross-campaign contact view with AI scores and filtering
- **Activity tracking** — Real-time engagement events (opens, clicks, replies)
- **Notifications** — Country-based Slack channel routing for activity alerts
- **Performance reporting** — Automated funnel metrics and action items

---

## Data Sync

A background sync workflow runs every 30 minutes, synchronizing state across all systems:

| Section | Flow | Method |
|---------|------|--------|
| A | CRM → PostgreSQL contacts | Upsert by CRM record ID |
| B | Campaign platform → PostgreSQL campaigns | Upsert by campaign ID |
| C | Campaign leads (CSV export) → PostgreSQL | Upsert by lead ID |
| D | Activities → PostgreSQL | Upsert by activity ID |
| E | New activities → Slack threads | Country-based channel routing |
| F | Sync log | Completion audit record |

---

## Data Stores

| Store | Role |
|-------|------|
| CRM (Airtable) | Source of truth for lead profiles and account data |
| PostgreSQL (Neon) | Workflow state: messages, campaigns, leads, activities, sync log |
| Campaign Platform (Lemlist) | Email/messaging sequence execution |
| Slack | Notification delivery and performance reporting |
