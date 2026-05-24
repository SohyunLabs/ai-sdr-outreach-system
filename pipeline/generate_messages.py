#!/usr/bin/env python3
"""
generate_messages.py — Fitogether AI SDR Message Generator

Usage:
    python generate_messages.py recID1 recID2 ...

Env vars required:
    AIRTABLE_API_KEY
    ANTHROPIC_API_KEY
"""

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import anthropic
import asyncpg
import requests

# --- Config ---
BASE_DIR = Path(__file__).parent

AIRTABLE_API_KEY = os.environ.get("AIRTABLE_API_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL_UNPOOLED", "")

BASE_ID = os.environ["AIRTABLE_BASE_ID"]
CONTACT_TABLE = os.environ["AIRTABLE_CONTACT_DB"]
LEMCAL_URL = os.environ.get("LEMCAL_URL", "")

EMAIL_BODY_FIELDS = {
    "M1_Initial_Body_Email",
    "M2_FU1_EmailOpen_Body_Email",
    "M3_FU1_EmailClose_Body_Email",
    "M6_Final_Body_Email",
}

LI_BODY_FIELDS = {
    "M1_Initial_Body_LI",
    "M2_FU1_EmailOpen_Body_LI",
    "M3_FU1_EmailClose_Body_LI",
    "M5_LI_Chat_Body",
    "M6_Final_Body_LI",
}

CONCURRENCY = 10  # Max parallel Claude API calls


# ---------------------------------------------------------------------------
# Airtable helpers
# ---------------------------------------------------------------------------

def _at_headers() -> dict:
    return {
        "Authorization": f"Bearer {AIRTABLE_API_KEY}",
        "Content-Type": "application/json",
    }


def fetch_contact(record_id: str) -> dict:
    url = f"https://api.airtable.com/v0/{BASE_ID}/{CONTACT_TABLE}/{record_id}"
    resp = requests.get(url, headers=_at_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


async def save_to_message_db(db_conn: asyncpg.Connection, contact_record_id: str, messages: dict, assignee: str) -> str:
    msg_id = str(uuid.uuid4())
    # 기존 pending(campaign_id = NULL) 메시지 삭제 — contact당 1개 유지
    await db_conn.execute(
        "DELETE FROM messages WHERE contact_id = $1 AND campaign_id IS NULL",
        contact_record_id,
    )
    await db_conn.execute(
        """
        INSERT INTO messages (
            id, contact_id, generated_at,
            m1_subject, m1_body_email, m1_body_li,
            m2_subject, m2_body_email, m2_body_li,
            m3_subject, m3_body_email, m3_body_li,
            m4_li_conn_req_body, m5_li_chat_body,
            m6_subject, m6_body_email, m6_body_li,
            assignee
        ) VALUES (
            $1, $2, NOW(),
            $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11,
            $12, $13,
            $14, $15, $16,
            $17
        )
        """,
        msg_id,
        contact_record_id,
        messages.get("M1_Initial_Subject"),
        messages.get("M1_Initial_Body_Email"),
        messages.get("M1_Initial_Body_LI"),
        messages.get("M2_FU1_EmailOpen_Subject"),
        messages.get("M2_FU1_EmailOpen_Body_Email"),
        messages.get("M2_FU1_EmailOpen_Body_LI"),
        messages.get("M3_FU1_EmailClose_Subject"),
        messages.get("M3_FU1_EmailClose_Body_Email"),
        messages.get("M3_FU1_EmailClose_Body_LI"),
        messages.get("M4_LI_ConnReq_Body"),
        messages.get("M5_LI_Chat_Body"),
        messages.get("M6_Final_Subject"),
        messages.get("M6_Final_Body_Email"),
        messages.get("M6_Final_Body_LI"),
        assignee,
    )
    return msg_id


def mark_ai_email_creation_done(record_id: str) -> None:
    url = f"https://api.airtable.com/v0/{BASE_ID}/{CONTACT_TABLE}/{record_id}"
    resp = requests.patch(
        url,
        headers=_at_headers(),
        json={"fields": {"AI Email Creation": True}},
        timeout=30,
    )
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Message generation helpers
# ---------------------------------------------------------------------------

def build_user_message(fields: dict) -> str:
    parts = []

    def add(label: str, *keys: str) -> None:
        for key in keys:
            val = fields.get(key, "")
            if isinstance(val, list):
                val = "\n".join(str(v) for v in val if v)
            if val:
                parts.append(f"{label}:\n{val}" if "\n" in str(val) or len(str(val)) > 60 else f"{label}: {val}")
                return

    add("Contact Name", "Contact_Name")
    add("Current Company", "Current_Company")
    add("Contact Profile", "Contact_Profile", "Contact Profile")
    add("About", "About")
    add("Experiences", "Experiences")
    is_author = fields.get("Is_Author") or False
    parts.append(f"Is Author of Content: {'Yes' if is_author else 'No'}")
    add("Recent Content", "Content (Concat)", "Content_Concat")
    if not is_author:
        parts.append("IMPORTANT: The contact did NOT write the content above. Do NOT use 'your post', 'you wrote', 'your article', or any phrasing that implies authorship.")
    add("Recent Interactions Summary", "AI Recent_Interactions_summary (Profile)", "AI_Recent_Interactions_summary", "AI Recent_Interactions_summary")
    add("Scoring Reason", "AI Scoring Reason (Profile)", "AI_Scoring_Reason_Profile")

    return "\n\n".join(parts)


def format_messages(messages: dict, assignee: str) -> dict:
    """Convert \\n to <br> for email body fields; keep \\n for LinkedIn fields.
    Also strip em-dashes as a post-processing guardrail.
    Appends Lemcal CTA to M2 and channel-appropriate sign-off to all fields except M4."""
    formatted = {}
    for key, value in messages.items():
        if isinstance(value, str):
            value = value.replace("\u2014", "").replace("\u2013", "")  # em-dash, en-dash
            if key in EMAIL_BODY_FIELDS:
                # if key == "M2_FU1_EmailOpen_Body_Email" and LEMCAL_URL:
                #     value = value + f'\n\nIf you\'re open to a quick conversation, feel free to <a href="{LEMCAL_URL}">book a short meeting here</a>.'
                value = value + f"\n\nWarm regards,\n{assignee}"
                value = value.replace("\n", "<br>")
            elif key in LI_BODY_FIELDS:
                # if key == "M2_FU1_EmailOpen_Body_LI" and LEMCAL_URL:
                #     value = value + f"\n\nIf you're open to a quick conversation, feel free to book a short meeting here: {LEMCAL_URL}"
                value = value + f"\n\nBest,\n{assignee}"
        formatted[key] = value
    return formatted


def parse_json_response(raw: str) -> dict:
    """Strip markdown fences if present and parse JSON."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```json) and last line (```)
        text = "\n".join(lines[1:-1]).strip()
    return json.loads(text)


# ---------------------------------------------------------------------------
# Core async task
# ---------------------------------------------------------------------------

M4_RETRY_SYSTEM = (
    "You are an SDR writing a LinkedIn connection request note for Fitogether, "
    "a sports performance technology company. "
    "Rules: TOTAL length must be UNDER 200 characters (count every character including spaces), "
    "exactly 3 sentences, no emojis, no pitch — just establish relevance and reason to connect. "
    "Respond ONLY with the note text, nothing else."
)


async def regenerate_m4(
    client: anthropic.AsyncAnthropic,
    name: str,
    user_message: str,
    attempt: int = 1,
) -> str:
    """Re-generate M4 alone when it exceeds 200 chars. Max 2 attempts."""
    print(f"  [{name}] Regenerating M4 (attempt {attempt})...", flush=True)
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=120,
        system=M4_RETRY_SYSTEM,
        messages=[{"role": "user", "content": user_message}],
    )
    m4 = response.content[0].text.strip()
    if len(m4) >= 200 and attempt < 2:
        return await regenerate_m4(client, name, user_message, attempt + 1)
    return m4


async def process_contact(
    semaphore: asyncio.Semaphore,
    client: anthropic.AsyncAnthropic,
    db_conn: asyncpg.Connection,
    system_prompt: str,
    record_id: str,
    assignee: str,
) -> dict:
    async with semaphore:
        # 1. Fetch contact
        print(f"  [{record_id}] Fetching contact...", flush=True)
        contact = await asyncio.to_thread(fetch_contact, record_id)
        fields = contact.get("fields", {})
        name = fields.get("Contact_Name", record_id)

        # 2. Build user message and call Claude
        print(f"  [{name}] Calling Claude API...", flush=True)
        user_message = build_user_message(fields)

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )

        # 3. Parse JSON output
        raw_json = response.content[0].text
        messages = parse_json_response(raw_json)

        # 4. Validate M4 — retry if over 200 chars
        m4 = messages.get("M4_LI_ConnReq_Body", "")
        if len(m4) >= 200:
            print(f"  [{name}] M4 is {len(m4)} chars — retrying M4...", flush=True)
            messages["M4_LI_ConnReq_Body"] = await regenerate_m4(client, name, user_message)
            m4 = messages["M4_LI_ConnReq_Body"]
            if len(m4) >= 200:
                print(f"  [{name}] WARNING: M4 still {len(m4)} chars after retry — manual review needed", flush=True)

        # 5. Apply formatting + sign-off
        formatted = format_messages(messages, assignee)

        # 6. Save to Neon messages (upsert)
        print(f"  [{name}] Saving to Neon messages...", flush=True)
        msg_id = await save_to_message_db(db_conn, record_id, formatted, assignee)

        print(f"  [{name}] Done → {msg_id}", flush=True)
        return {
            "name": name,
            "contact_id": record_id,
            "message_id": msg_id,
            "status": "success",
        }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main(record_ids: list, assignee: str) -> None:
    if not AIRTABLE_API_KEY:
        print("ERROR: AIRTABLE_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL_UNPOOLED environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    # Load KB and system prompt
    kb_path = BASE_DIR / "knowledge" / "fitogether_sdr_kb.md"
    prompt_path = BASE_DIR / "prompts" / "system_prompt.md"

    if not kb_path.exists():
        print(f"ERROR: Knowledge base not found at {kb_path}", file=sys.stderr)
        sys.exit(1)
    if not prompt_path.exists():
        print(f"ERROR: System prompt not found at {prompt_path}", file=sys.stderr)
        sys.exit(1)

    kb = kb_path.read_text()
    system_template = prompt_path.read_text()
    system_prompt = system_template.replace("{FITOGETHER_KB}", kb)

    print(f"Generating messages for {len(record_ids)} contact(s) (assignee={assignee}, concurrency={CONCURRENCY})...\n")

    client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
    semaphore = asyncio.Semaphore(CONCURRENCY)
    db_conn = await asyncpg.connect(DATABASE_URL)

    try:
        tasks = [
            process_contact(semaphore, client, db_conn, system_prompt, rid, assignee)
            for rid in record_ids
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    finally:
        await db_conn.close()

    print("\n--- Summary ---")
    success_count = 0
    successful_contact_ids = []
    for r in results:
        if isinstance(r, Exception):
            print(f"  ERROR: {r}")
        else:
            print(f"  {r['name']} ({r['contact_id']}) -> Neon messages: {r['message_id']}")
            success_count += 1
            successful_contact_ids.append(r['contact_id'])

    # Batch mark AI Email Creation = TRUE (outside semaphore, after all generation)
    if successful_contact_ids:
        print(f"\nMarking AI Email Creation = TRUE for {len(successful_contact_ids)} contact(s)...")
        at_headers = {
            "Authorization": f"Bearer {AIRTABLE_API_KEY}",
            "Content-Type": "application/json",
        }
        for i in range(0, len(successful_contact_ids), 10):
            batch = successful_contact_ids[i:i+10]
            payload = {"records": [{"id": rid, "fields": {"AI Email Creation": True}} for rid in batch]}
            import requests as _req
            _req.patch(
                f"https://api.airtable.com/v0/{BASE_ID}/{CONTACT_TABLE}",
                headers=at_headers,
                json=payload,
                timeout=30,
            ).raise_for_status()

    print(f"\n{success_count}/{len(record_ids)} completed successfully.")
    if success_count < len(record_ids):
        sys.exit(1)


if __name__ == "__main__":
    args = sys.argv[1:]

    # Parse optional --assignee "Name" flag
    assignee = "Assignee"
    if "--assignee" in args:
        idx = args.index("--assignee")
        if idx + 1 < len(args):
            assignee = args[idx + 1]
            args = args[:idx] + args[idx + 2:]
        else:
            print("ERROR: --assignee requires a name argument", file=sys.stderr)
            sys.exit(1)

    if not args:
        print("Usage: python generate_messages.py [--assignee 'Name'] recID1 recID2 ...")
        print("Example: python generate_messages.py --assignee 'Sales Manager A' recXXXXXXXXX recYYYYYYYYY")
        sys.exit(1)

    asyncio.run(main(args, assignee))
