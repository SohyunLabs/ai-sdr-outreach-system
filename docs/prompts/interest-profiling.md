# Interest Profiling Agent

**Model**: GPT-4o-mini (via n8n Agent Node)
**Purpose**: Summarize professional interests from recent content engagement activity
**Stage**: T4 -- Post-qualification enrichment

---

## Why GPT-4o-mini Instead of Claude?

This agent processes hundreds of individual profiles. Each call is a straightforward summarization task (not complex reasoning), making a smaller, cheaper model the right choice. GPT-4o-mini provides adequate quality for 2-4 sentence interest summaries at a fraction of the cost.

---

## System Prompt

```
Role: You are an Interest Profiling Specialist for a B2B SaaS company
specializing in performance tracking technology for professional sports teams.

Objective: Analyze a user's recent content interactions (posts they
liked, commented on, or shared) and produce a concise natural language summary
of their professional interests and focus areas.

Context: This summary will be used for:
- Personalizing cold outreach messages
- Prioritizing leads by relevance to the company's solutions

Instructions:
- Identify 3-5 key interest themes from the content.
- Note the dominant focus area if one is clearly dominant.
- Mention relevance to sports performance, GPS tracking, or athlete monitoring
  if applicable.
- If the content shows no clear professional pattern or is too sparse to
  analyze, note this explicitly.
- Keep the summary to 2-4 sentences.
- Write in English.
- Be specific about topics rather than generic (e.g., "hamstring injury
  prevention using GPS load data" rather than just "sports science").
```

## Structured Output

| Field | Type | Description |
|-------|------|-------------|
| interest_summary | string | 2-4 sentence natural language summary |

**Example output**:
```
Primarily focused on injury prevention and return-to-play protocols, with strong
interest in GPS-based load monitoring for football. Also engages with hamstring
injury prediction research and IMU sensor technology discussions. Shows consistent
attention to practical applications of sports science in professional team settings.
```

## User Prompt

```
Task: Analyze the following user's recent content interactions and
summarize their professional interests.

Recent Content Interactions (up to 10 most recent posts they engaged with):
{{ $json.text_concat }}

Instructions: Identify the key interest themes and provide a concise natural
language summary of this person's professional focus areas.
```

## Preprocessing (n8n Code Node)

Before passing to the agent, raw post content is tagged with position markers:

```
[POST 1/10]
The role of GPS tracking in modern football has evolved significantly...

[POST 2/10]
New research on hamstring injury prevention shows promising results...

[POST 3/10]
Load monitoring during pre-season: key metrics every S&C coach should track...
```

**Design choices**:
- Position tags (`[POST N/10]`) serve as reliable delimiters that don't appear in source content
- Only body text is included -- metadata (hashtags, URLs, author info) doesn't add meaningful signal for interest summarization
- Raw content is **not stored** in Airtable -- only the agent's summary output is persisted. If re-generation is needed (e.g., prompt changes), the source adapter re-collects the data.

## Execution Modes

| Mode | Target Profiles | Trigger |
|------|----------------|---------|
| Automatic | `AI_Interest_Summary` is empty (new profiles) | Daily schedule |
| Manual | Specific profiles or conditional re-collection | Manual trigger |

## Design Notes

- **Content-only input**: Profile information (name, headline, experience) is intentionally excluded from this agent's input. The goal is pure interest signal from content engagement, not profile-based inference (which is already captured by the Profile Scoring agent).
- **No-store policy**: Raw source content is ephemeral in the n8n workflow. This reduces storage costs and avoids retaining third-party content long-term.
- **Specificity instruction**: The prompt explicitly asks for specific topics ("hamstring injury prevention using GPS load data") rather than generic labels ("sports science") to maximize personalization value in downstream message generation.
