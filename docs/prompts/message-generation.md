# Message Generation Agent

**Model**: Claude Sonnet (claude-sonnet-4-6, via Python Anthropic SDK)
**Purpose**: Generate 6 personalized outreach messages per lead
**Stage**: Phase 2 -- Core message generation (`generate_messages.py`)

---

## Architecture

Unlike the n8n-based agents in Phase 1, this agent is called from a Python script using the Anthropic SDK directly. This allows for:
- Async parallel processing (10 concurrent API calls via `asyncio.Semaphore`)
- Knowledge base injection at runtime
- Structured JSON output parsing with retry logic
- Post-processing (channel-specific formatting, character limit validation)

---

## System Prompt Structure

The system prompt is a template that gets the company knowledge base injected at runtime:

```
You are an expert B2B sales development representative (SDR) for [Company],
a B2B SaaS company. Your job is to write highly personalized
cold outreach messages for football (soccer) performance professionals.

---

## About [Company]

{KNOWLEDGE_BASE}    <-- Injected from knowledge/kb.md at runtime

---

## Your Task

Given a prospect's profile data, generate 6 outreach messages in JSON format.
Each message must be highly personalized based on the prospect's background,
role, experiences, and any recent interactions.
```

## Message Specifications

| Message | Field Prefix | Channel | Length | Approach |
|---------|-------------|---------|--------|----------|
| M1 Initial | M1_Initial | Email + Professional Network | 100-125 words | Problem framing based on prospect's specific pain. Low-friction CTA. |
| M2 Follow-up | M2_FU1_EmailOpen | Email + Professional Network | 100-125 words | Reference M1. New case study or proof point. |
| M3 Re-engagement | M3_FU1_EmailClose | Email + Professional Network | 100-125 words | Stronger hook with compelling stat/data. Different angle from M1. |
| M4 Connection | M4_LI_ConnReq | Professional Network only | < 200 chars, 3 sentences | Personalized connection request. No pitch. |
| M5 Chat | M5_LI_Chat | Professional Network only | ~100 words | Trust-building conversation after connecting. |
| M6 Final | M6_Final | Email + Professional Network | 100-125 words | Different angle from all previous + exit statement. |

### Per-Message Field Structure

Each message (except M4 and M5) generates three fields:
- `{prefix}_Subject` -- Email subject line
- `{prefix}_Body_Email` -- Email body (post-processed: `\n` -> `<br>`)
- `{prefix}_Body_LI` -- Professional network DM version (keeps `\n`)

M4 generates only `M4_LI_ConnReq_Body`. M5 generates only `M5_LI_Chat_Body`.

## Critical Rules

```
1. Company name must be spelled correctly (no variations)
2. No emojis
3. No generic filler -- every sentence must earn its place
4. Anchor claims to specific, verifiable proof points
5. M4 is strictly under 200 characters -- count carefully
6. All messages in English
7. No sign-off -- sign-offs are added programmatically after generation
7a. Start with "Hi [FirstName]," using the prospect's actual first name.
    Never use placeholders or template syntax.
8. Never use em dashes or hyphens as em-dash substitutes. Restructure
   sentences using commas, colons, or periods instead.
9. Content attribution rules:
   - If prospect IS the author: may reference "your post/article about..."
   - If prospect is NOT the author (only liked/commented/shared):
     NEVER imply authorship. Use content only as silent context to infer
     interests. The prospect must not feel tracked.
10. Interest summary is a general signal -- use for thematic context only,
    not to reference or quote specific posts.
```

## Output Format

```json
{
  "M1_Initial_Subject": "...",
  "M1_Initial_Body_Email": "...",
  "M1_Initial_Body_LI": "...",
  "M2_FU1_EmailOpen_Subject": "...",
  "M2_FU1_EmailOpen_Body_Email": "...",
  "M2_FU1_EmailOpen_Body_LI": "...",
  "M3_FU1_EmailClose_Subject": "...",
  "M3_FU1_EmailClose_Body_Email": "...",
  "M3_FU1_EmailClose_Body_LI": "...",
  "M4_LI_ConnReq_Body": "...",
  "M5_LI_Chat_Body": "...",
  "M6_Final_Subject": "...",
  "M6_Final_Body_Email": "...",
  "M6_Final_Body_LI": "..."
}
```

## User Prompt (built dynamically per prospect)

```
Generate 6 outreach messages for this prospect:

Contact Name: Jane Smith
Current Company: Sample Corp
Contact Profile: Head of Operations
Experiences: [work history]
About: [profile summary]
AI Interest Summary: [2-4 sentence interest profile]
Is Author of Content: No
Content (Concat): [aggregated content they engaged with]
Country: United Kingdom
Email: jane.smith@example.com
```

## Post-Processing Pipeline

After receiving JSON output from Claude:

1. **JSON parsing** -- Strip markdown fences if present, parse JSON
2. **M4 character validation** -- If M4 exceeds 200 characters, regenerate M4 only (max 2 retries)
3. **Channel-specific formatting**:
   - Email body fields: `\n` -> `<br>` (HTML line breaks)
   - Professional network body fields: keep `\n` as-is
4. **Sign-off injection**:
   - Email: append `Warm regards,\n\n{assignee}`
   - Professional network (M1-M3 LI, M5, M6 LI): append `Best,\n\n{assignee}`
   - M4 (connection request): no sign-off
5. **Database insert** -- Save to Neon PostgreSQL `messages` table via asyncpg

## Design Notes

- **Knowledge base injection**: The company KB is loaded once and injected into every system prompt via string replacement (`{COMPANY_KB}`). This keeps the KB maintainable as a separate markdown file while ensuring every API call has full product context.
- **M4 retry logic**: The professional network platform enforces a hard 200-character limit on connection request notes. Rather than truncating (which produces awkward messages), the script asks Claude to regenerate M4 specifically, providing the character count and asking for a shorter version.
- **Content attribution rules (Rule 9)**: This is the most nuanced prompt rule. Most collected profiles engaged with content (liked/shared) but didn't author it. Referencing content they merely liked ("I saw your post about...") feels surveillance-like. The prompt draws a hard line: only reference content if the prospect actually wrote it.
- **Concurrent processing**: `asyncio.Semaphore(10)` limits concurrent Claude API calls to 10, balancing throughput against API rate limits. Processing hundreds of profiles is handled efficiently through async batching.
