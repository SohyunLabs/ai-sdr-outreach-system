# /sdr:generate — Message Generation + Save to DB

Generate personalized outreach messages for confirmed leads and save to PostgreSQL.

## Step 1: Confirm target leads

If called after `/sdr:select`, use the confirmed record IDs from that session.
If called standalone, ask for contact names or CRM record IDs.

## Step 1.5: Assignee

If previous context has an assignee, confirm it.
Otherwise, ask:
```
Select assignee:
1) Sales Rep A
2) Sales Rep B
3) Sales Rep C
```

The confirmed assignee is passed to the generation script via `--assignee` flag.

## Step 2: Run generate_messages.py

Execute from the project root:

```bash
python generate_messages.py --assignee "Sales Rep A" recID1 recID2 ...
```

The script handles: CRM fetch, LLM API calls, PostgreSQL storage, and CRM status update.

Channel-specific sign-offs are appended automatically:
- Email body: "Warm regards,\n\n{assignee}"
- Messaging body: "Best,\n\n{assignee}"
- M4 (connection request): no sign-off

## Step 3: Confirm completion

Parse script output and report:

```
Complete. [N] messages generated and saved. (Assignee: {assignee})
- [Name 1] — message ID: uuid-xxx
- [Name 2] — message ID: uuid-xxx

Run `/sdr:campaign_assign` to assign to a campaign.
```

**Post-execution checks:**
- If output contains Error, Exception, traceback, or failed → stop immediately
- If 0 records succeeded → stop immediately

Store generated message IDs in context for `/sdr:campaign_assign`.
