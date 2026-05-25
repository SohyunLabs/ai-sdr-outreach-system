# /sdr:select — AI Lead Selection

You are helping a sales rep select the best leads to reach out to today.

## Step 0: Assignee & Region

Before querying the CRM, ask for assignee and target region.

**Assignee prompt:**
```
Select assignee:
1) Sales Rep A
2) Sales Rep B
3) Sales Rep C
```

**Region prompt:**
```
Select target region:
1) APAC
2) EMEA
3) NAM
```

Store both values for use in subsequent steps.

## Step 1: Load candidates from CRM

Query the CRM database to fetch all candidate records.

```python
import requests, json, re, os

env = {}
for line in open('.env'):
    line = line.strip()
    m = re.match(r'^([^#=\s]+)\s*=\s*"?([^"]*)"?$', line)
    if m: env[m.group(1)] = m.group(2).strip()

API_KEY = env['AIRTABLE_API_KEY']
BASE_ID = env['AIRTABLE_BASE_ID']
TABLE_ID = env['AIRTABLE_CONTACT_DB']
headers = {'Authorization': f'Bearer {API_KEY}'}

all_records = []
offset = None
while True:
    params = {'view': 'for_claude', 'pageSize': 100}
    if offset:
        params['offset'] = offset
    r = requests.get(f'https://api.airtable.com/v0/{BASE_ID}/{TABLE_ID}',
                     headers=headers, params=params)
    data = r.json()
    all_records.extend(data.get('records', []))
    offset = data.get('offset')
    if not offset:
        break

print(json.dumps({'count': len(all_records), 'records': all_records}, ensure_ascii=False))
```

**Post-execution checks:**
- If output contains traceback or error → stop immediately
- If count is 0 → stop immediately

## Step 1.3: Account Status Classification

Classify accounts and exclude current customers/negotiations from the candidate pool.

Account status priority:
| Status | Condition |
|--------|-----------|
| `client` | Active contract exists |
| `negotiating` | Open opportunity exists |
| `churned` | Contract exists but no open opportunity |
| `lost_deal` | Opportunity exists but no contract |
| `no_comm` | None of the above |

Exclude `client` and `negotiating` accounts from the candidate pool.

## Step 1.5: Campaign History Check

Query the PostgreSQL database to check for existing campaign participation.

Results:
- `active` = currently in a non-archived campaign → **exclude**
- `unassigned` = messages generated but not campaign-assigned → **exclude**
- `reengagement` = only in archived campaigns → **flag as re-engagement candidate**
- Not in DB = new candidate → **keep**

## Step 2: Analyze candidates

Evaluate remaining candidates based on:

**Strong signals (prioritize):**
- High AI score (8-10)
- Interest summary mentions relevant technology or workflows
- Role at professional/semi-professional organization
- Content creator flag (authored relevant content)

**Weak signals (deprioritize):**
- AI score below 6
- Purely academic, recreational, or irrelevant role
- Profile shows focus outside target industry

## Step 3: Present recommendations

Output a ranked shortlist of **20 leads**:

| # | Name | Company | Score | Status | Why |
|---|------|---------|-------|--------|-----|
| 1 | ... | ... | 9/10 | New | One-line reason |
| 2 | ... | ... | ... | Re-engagement | ... |

## Step 4: Confirm

Ask for confirmation before proceeding to message generation.
Store confirmed record IDs, assignee, and region for `/sdr:generate`.
