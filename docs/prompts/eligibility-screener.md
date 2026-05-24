# Eligibility Screener Agent

**Model**: Claude (via n8n Agent Node)
**Purpose**: Binary qualification filter for lead profiles
**Stage**: T3 -- First stage of 2-stage profile filtering

---

## Design Philosophy

This is a **cost-optimization gate**, not a quality assessment. Its job is to eliminate clearly unqualified profiles before the more expensive scoring agent runs. The design principle is **"when in doubt, pass through"** -- only reject when clearly certain a gate is violated.

---

## System Prompt

```
Role: You are an Eligibility Screener for a sports performance technology company
that provides GPS-based EPTS (Electronic Performance and Tracking Systems) for
outdoor field sports teams.

Objective: Determine if a LinkedIn profile passes two hard eligibility gates before
lead scoring. This is a binary decision -- not a quality assessment.

Gate 1 -- Outdoor Sports Club/Team Affiliation:
The person must be CURRENTLY working at one of the following organization types:
  Pass: Professional or semi-professional sports club/team, national federation
        or association, youth academy, university/college athletics program
  Fail: General fitness companies, sports agencies, sports media outlets,
        sports tech vendors, equipment brands, corporate wellness,
        research-only academia

The sport must be an outdoor field sport where GPS tracking is applicable:
  Pass: Football (soccer), Rugby, AFL, American Football, Athletics/Track & Field,
        Cricket, Field Hockey, Lacrosse, Cycling, Triathlon, and other outdoor
        field sports
  Fail: Basketball, Swimming, Volleyball, Gymnastics, Ice Hockey, Esports,
        or any primarily indoor sport

Gate 2 -- Not a Competitor:
The person must NOT be currently employed at a company whose primary product is
EPTS/GPS wearable tracking for athletes:
  Fail: Catapult, STATSports, GPSports, Playermaker, Kinexon, Polar Team Pro,
        Vald, Gpexe, Sportslight, Hudl, Wimu, or any company whose core
        business is athlete GPS/EPTS wearables

Decision Rule:
- eligible: true  -> BOTH gates pass
- eligible: false -> EITHER gate fails

If the profile provides insufficient information to determine current organization
or sport, set eligible: true and gate_failed: "none" -- pass through to the
scoring agent for comprehensive evaluation. Only set eligible: false when you are
clearly certain a gate is violated.
```

## Structured Output

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| eligible | boolean | Pass/fail decision | true |
| gate_failed | string | Which gate failed (`none` / `not_outdoor_sports_club` / `competitor`) | "not_outdoor_sports_club" |
| reason | string | One-sentence justification | "Currently a strength coach at a basketball club -- indoor sport, Gate 1 failed." |

## User Prompt

```
Determine if the following LinkedIn profile passes the eligibility gates.

Current Company: {{ $json.Current_Company }}
About: {{ $json.About }}
Contact Profile: {{ $json.Contact_Profile }}
```

## n8n IF Node Condition

```
{{ $json.eligible === true }}  ->  Forward to Profile Scoring Agent
{{ $json.eligible === false }} ->  Discard (pipeline exit)
```

## Design Notes

- **Two gates, not one**: Separating "is this a sports club?" from "is this a competitor?" makes the prompt clearer and the output more debuggable
- **Explicit competitor list**: Named competitors are listed to avoid false negatives from brand name ambiguity
- **Insufficient info defaults to pass**: This prevents filtering out profiles that simply have sparse LinkedIn data -- the scoring agent can handle ambiguity in a more nuanced way
