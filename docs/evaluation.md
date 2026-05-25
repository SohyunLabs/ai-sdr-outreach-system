# Evaluation and QA

Quality assurance mechanisms built into the AI SDR pipeline.

---

## Message Generation QA

### JSON Validity
- LLM response parsed with markdown fence stripping
- Parse failures logged per-lead with error details

### Message Completeness
- All 14 fields validated per lead:
  - 4 messages x (subject + email body + messaging body) = 12 fields
  - M4 connection request body = 1 field
  - M5 chat body = 1 field
- Missing fields trigger processing errors in batch summary

### Character Limit Compliance
- M4 (connection request) validated against 200-character limit
- Exceeding limit triggers automatic regeneration with a focused retry prompt
- Maximum 2 retry attempts; remaining violations flagged for manual review

### Content Quality Guardrails
- Em-dash stripping (post-processing)
- Content attribution rules: non-author engagement data used only as silent context, never referenced directly
- No-signoff enforcement: sign-offs injected programmatically after generation
- Channel-specific formatting: HTML line breaks for email, plain newlines for messaging

---

## Lead Qualification QA

### Scoring Consistency
- 3-axis decomposition (instead of single holistic score) for auditability
- Strict scoring instruction to prevent LLM score inflation
- Insufficient profile data defaults to score 1, not mid-range

### Eligibility Screening
- Binary decision with explicit gate identification
- Insufficient information defaults to pass-through (conservative filtering)
- Named competitor list to avoid false negatives from brand ambiguity

---

## Pipeline-Level QA

### Duplicate Prevention
- Active campaign check during lead selection (non-archived campaigns)
- Unassigned message check (generated but not campaign-assigned)
- CRM-level account status classification (client/negotiating/churned/lost_deal)

### Review Metrics
- Dashboard tracks per-message: viewed / edited / approved / rejected
- Edit history preserved for message modification audit trail
- Apply/discard workflow for campaign platform sync

### Campaign Handoff Readiness
- Email availability check (email-only campaigns skip leads without email)
- Duplicate lead check at campaign platform level
- Batch launch with post-launch data sync

### Failure-Mode Logging
- Per-lead error capture in async batch processing
- Summary report: success count, failure count, error details
- Non-zero exit code on partial failures
