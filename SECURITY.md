# Security Policy

## Public Portfolio Version

This repository is a sanitized public portfolio artifact. It contains **no production credentials, real customer data, or internal service endpoints**.

## Guidelines

- **Do not commit secrets.** Use environment variables for all API keys, tokens, and credentials. See `.env.example` for the required variables.
- **Use `.env` files locally.** The `.gitignore` excludes `.env`, `.env.local`, and `.env.production` by default.
- **This repo contains synthetic data only.** All sample data in `sample_data/` uses fictional names, companies, and email addresses on safe domains (e.g., `example.com`).
- **Production integrations are excluded.** Internal webhook URLs, real Slack channel IDs, and production database connection strings have been removed.
- **Report accidental exposure immediately.** If you discover that real credentials or personal data have been accidentally committed, notify the repository owner and rotate any exposed credentials.

## What This Repo Does NOT Contain

- Production API keys or tokens
- Real prospect or customer names, emails, or company names
- Internal URLs, webhook endpoints, or service configurations
- Real campaign data or performance metrics
- Company-specific knowledge base content
