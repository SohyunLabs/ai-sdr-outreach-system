# /sdr:report — Campaign Performance Report

Generate a performance report across all active campaigns and post to Slack.

## Step 1: Query database

Execute the reporting query to fetch:
- Cumulative funnel metrics (messages generated → launched → engaged → replied)
- Per-campaign performance breakdown
- Lead-level detail with activity history
- Unlaunched leads (generated but not added to campaign platform)

## Step 2: Generate report

Format the report with these sections:

### Section 1: Funnel Summary
- Messages generated, launched, awaiting launch
- Channel-specific metrics (email: sent→opened→replied; messaging: invited→accepted→replied)

### Section 2: Per-Campaign Performance
- Campaign name, status, lead count
- Channel-specific engagement rates
- Action commentary per campaign

### Section 3: Insights
1. Channel role analysis (email vs. messaging effectiveness)
2. Post-connection conversion rates
3. Send failure patterns
4. Bounce rate analysis
5. Regional response distribution

### Section 4: Action Items
- Leads with replies requiring manual follow-up (grouped by assignee)
- Accepted connections with stalled sequences
- Send failures requiring channel switch
- Generated but unlaunched leads

## Step 3: Review and post

Present report for review, then post to Slack channel.
