# /sdr:campaign_assign — Campaign Assignment

Assign generated messages to a campaign in the database.
Actual campaign platform operations are handled by the dashboard.

## Step 1: Target records

Use message IDs from previous `/sdr:generate` session.
If unavailable, ask for message IDs.

## Step 2: Campaign selection

If campaign ID is provided as argument, use it directly.

Otherwise, query available campaigns and present:

```
Available campaigns:

| # | Campaign Name | Status | ID |
|---|--------------|--------|-----|
| 1 | APAC Outreach - Email - Q1 | draft | cam_xxx |
| 2 | ... | ... | ... |

Select a campaign (number or ID).
```

## Step 2.5: Assignee

Confirm or select assignee (same as generate step).

## Step 3: Database update

Query PostgreSQL for messages + contacts, then:
- Update `contacts.assignee`
- Update `messages.campaign_id` and `messages.sequence_type`

## Step 4: Completion report

```
Complete. [N] leads assigned to campaign [{campaign_id}]. (Assignee: {assignee})

Processed contacts:
- Jane Doe (jane.doe@example.com)
- ...

Check the dashboard "To Launch" section to review and launch.
```
