# Privacy and Redaction

This is a **sanitized public portfolio version** of an AI-assisted SDR workflow.

---

## What Was Removed

- **Company-specific knowledge base** — Replaced with a structural template showing section headings and placeholder content
- **Real prospect and customer records** — All contact names, emails, company names, and profile data are fictional
- **Production credentials** — API keys, tokens, database connection strings, and webhook URLs replaced with placeholder values
- **Internal URLs** — Slack channel IDs, Airtable base/table IDs, and n8n webhook endpoints removed
- **Proprietary sales playbooks** — Company-specific messaging strategy, proof points, and positioning removed
- **Private workflow configuration** — Internal team assignments, real campaign names, and operational details generalized
- **Real campaign data** — Performance metrics, lead counts, and engagement data from production use are not included
- **Company branding** — Logo references point to generic placeholders

## What Was Replaced with Synthetic Data

- `sample_data/sample_contacts.json` — 5 fictional lead profiles with realistic but invented names, companies, and emails
- `sample_data/sample_source_signals.json` — 3 fictional content signals showing scored/unscored examples
- `sample_data/sample_messages.json` — 1 sample message set demonstrating the 6-message output format
- `sample_data/sample_campaigns.json` — 3 fictional campaign records

All synthetic data uses safe domains (`example.com`) and fictional organization names.

## No Real Personal Data

This repository contains **no real personal information** — no real names, email addresses, company affiliations, or social media profiles of actual individuals.

## Compliance Note

Any production implementation of similar data collection workflows must comply with:
- Source platform terms of service
- Applicable privacy laws (GDPR, CCPA, etc.)
- Organizational data protection policies
- Consent requirements for personal data processing
