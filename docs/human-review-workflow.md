# Human-in-the-Loop Review Workflow

AI generates message drafts. Humans review, edit, and approve before any outreach is sent.

---

## Principles

1. **AI drafts, humans decide.** No message is sent without explicit human approval.
2. **Edit transparency.** All modifications are tracked and can be applied to or discarded from the campaign platform.
3. **Batch control.** Managers can review and launch multiple leads at once or handle them individually.

---

## Workflow

### Step 1: AI Message Generation

The pipeline generates 6 personalized messages per lead:
- M1-M3: Email sequence (initial, follow-up, re-engagement)
- M4: Connection request (character-limited)
- M5: Chat message (after connection)
- M6: Final email (different angle + exit statement)

Messages are stored in PostgreSQL with status `pending` (no campaign assigned yet).

### Step 2: Campaign Assignment

An orchestration skill assigns messages to a campaign and team member. Messages move to `assigned` status and appear in the dashboard's "To Launch" queue.

### Step 3: Human Review

Sales managers open the dashboard and review each lead:
- **Message preview** — Full sequence view with all 6 messages
- **Inline editing** — Click to edit any message field directly
- **Save changes** — Modifications saved to database

### Step 4: Approve or Reject

- **Approve (Launch)** — Select leads via checkbox, click "Launch" to add them to the campaign platform
- **Individual launch** — Click into a lead's detail page for single-lead launch
- **Reject** — Simply don't launch; lead remains in "To Launch" queue

### Step 5: Post-Launch Editing

Even after launch, messages can be modified:
- Edit message content in the dashboard
- **Apply Changes** — Push edits to the campaign platform
- **Discard Changes** — Revert to the campaign platform's current version

### Step 6: Activity Monitoring

After launch, the dashboard tracks engagement:
- Email: sent, opened, clicked, replied, bounced
- Messaging: invite sent, accepted, message sent, replied
- All activities synced every 30 minutes

### Step 7: Notification

New engagement activities trigger Slack notifications:
- Routed to country-specific channels
- Threaded per-lead for conversation continuity
- Reply and acceptance events flagged for manual follow-up

---

## Feedback Loop

The review workflow creates a natural feedback loop:
- High edit rates on specific message types signal prompt improvement opportunities
- Rejection patterns indicate qualification criteria adjustments
- Reply rates per campaign inform channel and messaging strategy
