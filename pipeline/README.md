# AI SDR Pipeline

AI-powered message generation pipeline for a B2B SaaS outreach system.

This is the **public portfolio version**. Company-specific knowledge base content, production credentials, and internal team details have been removed.

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- API access: Airtable, campaign platform, PostgreSQL, Anthropic API

---

## Setup

```bash
pip install -r requirements.txt
npm install
cp .env.example .env   # Fill in your API keys
```

> Use your own API keys for local testing. Do not commit credentials. See `.env.example` for required environment variables.

---

## Usage

This pipeline is designed to be orchestrated via Claude Code custom skills:

### Step 1: Lead Selection
```
/sdr:select
```
Queries the CRM database, checks campaign history, and recommends top leads.

### Step 2: Message Generation
```
/sdr:generate
```
Generates 6 personalized outreach messages per confirmed lead and saves to PostgreSQL.

### Step 3: Campaign Assignment
```
/sdr:campaign_assign
```
Assigns generated messages to a campaign. Leads appear in the dashboard's "To Launch" queue.

---

## Project Structure

```
pipeline/
├── .claude/commands/sdr/     # Claude Code skill definitions
│   ├── select.md             # Lead selection skill
│   ├── generate.md           # Message generation skill
│   ├── campaign_assign.md    # Campaign assignment skill
│   └── report.md             # Performance reporting skill
├── generate_messages.py      # Core message generation script
├── knowledge/
│   └── sample_company_kb.md  # Company knowledge base (template)
├── prompts/
│   └── system_prompt.md      # LLM system prompt
├── requirements.txt
└── package.json
```
