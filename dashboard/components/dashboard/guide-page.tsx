"use client";

import { Terminal, ArrowRight, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// --- Skill Guide ---

interface Step {
  number: number;
  command: string;
  title: string;
  description: string;
  details: string[];
  note?: string;
}

const steps: Step[] = [
  {
    number: 1,
    command: "/sdr:select",
    title: "Lead Selection",
    description: "Selects the top 20 leads from the CRM database for today's outreach.",
    details: [
      "Queries CRM database (view: for_claude) for all candidates",
      "Checks campaign history in PostgreSQL -- excludes leads in active campaigns, flags archived-only leads for re-engagement",
      "Ranks by AI score, recent interactions, role, and email availability",
      "Final list can be adjusted (add/remove) before confirmation",
    ],
    note: "Confirmed record IDs are automatically passed to the next skill.",
  },
  {
    number: 2,
    command: "/sdr:generate",
    title: "Message Generation",
    description: "Generates 6 personalized outreach messages per confirmed lead and saves to PostgreSQL.",
    details: [
      "M1 initial email, M2-M3 email follow-ups (100-125 words each)",
      "M4 LinkedIn connection request (strict 200 character limit), M5 LinkedIn chat",
      "M6 final email -- different angle + Exit Statement included",
      "Knowledge base grounded personalization -- each lead's profile, experience, and content reflected",
    ],
    note: "Generated message IDs are automatically passed to campaign_assign.",
  },
  {
    number: 3,
    command: "/sdr:campaign_assign",
    title: "Campaign Assignment",
    description: "Saves generated messages and contact info to the database and assigns to a campaign. Actual campaign platform launch is done via the dashboard Launch button.",
    details: [
      "Queries available campaigns and selects target campaign",
      "Assigns owner and updates contacts.assignee in the database",
      "Saves each lead's message fields to the database -- prepared as campaign platform custom variables",
      "Leads without email are skipped, already-existing leads are skipped",
    ],
    note: "After running this skill, leads appear in the Campaign Analysis 'To Launch' section. Click the Launch button to add them to the campaign platform.",
  },
];

function SkillGuideTab() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-base font-semibold">Overview</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Run the skills below in order from your CLI to operate the outreach pipeline.
          Each skill automatically passes required data to the next.
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm">
          {steps.map((step, i) => (
            <div key={step.command} className="flex items-center gap-2">
              <code className="rounded bg-primary/10 px-2 py-1 text-xs font-mono font-semibold text-primary">
                {step.command}
              </code>
              {i < steps.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {steps.map((step) => (
          <div key={step.command} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {step.number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                  <code className="text-sm font-mono font-semibold">{step.command}</code>
                  <span className="text-sm text-muted-foreground">-- {step.title}</span>
                </div>
                <p className="mt-2 text-sm text-foreground">{step.description}</p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {step.details.map((d) => (
                    <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500/70" />
                      {d}
                    </li>
                  ))}
                </ul>
                {step.note && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />
                    <p className="text-xs text-muted-foreground">{step.note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Dashboard Integration</h3>
        <div className="mt-1.5 text-sm text-muted-foreground flex flex-col gap-2">
          <p>
            After running <code className="font-mono text-xs">/sdr:campaign_assign</code>,
            leads appear in the Campaign Analysis tab under the <strong>To Launch</strong> section.
          </p>
          <ol className="list-decimal list-inside flex flex-col gap-1 pl-1">
            <li>Select leads to launch using checkboxes (bulk select available)</li>
            <li>
              Click the <strong>Launch</strong> button -- selected leads are added to the campaign platform and automatically synced
            </li>
            <li>Launched leads move to the <strong>Launched</strong> section</li>
          </ol>
          <p>
            Leads added through this skill have their{" "}
            <code className="font-mono text-xs">CRM Contact ID</code> saved automatically,
            so name, company, and title information appears in the table.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Campaign Analysis ---

interface GuideSection {
  title: string;
  body: React.ReactNode;
}

function SectionCard({ title, body }: GuideSection) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</div>
    </div>
  );
}

const STATUS_COLOR_ROWS = [
  { color: "bg-blue-500", meaning: "In Progress", states: "Scanned, Reviewed, Email sent/opened, LinkedIn visit/message/invite" },
  { color: "bg-green-500", meaning: "Responded/Interested", states: "Email reply, LinkedIn accept/reply, Interested" },
  { color: "bg-red-500", meaning: "Issue", states: "Bounced, Send failed, Unsubscribed, Not interested" },
  { color: "bg-gray-400", meaning: "Done/Other", states: "Completed, Paused, Skipped, Manual" },
];

function CampaignAnalysisTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold">Overview</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Monitors lead status for a selected campaign.
          Use the summary cards for a quick overview, and the table for detailed per-lead status.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Launch Button"
          body={
            <>
              After running <code className="font-mono text-xs">/sdr:campaign_assign</code>, leads in the To Launch section can be added to the campaign platform.
              Select leads with checkboxes, then click to bulk-launch them. Data sync runs automatically after launch.
              Launched leads move to the Launched section.
            </>
          }
        />

        <SectionCard
          title="Data Sync Button"
          body="Fetches the latest data from the campaign platform API and saves to the database. Campaign status, lead status, and sequence progress are updated. Click this if you made changes directly on the platform."
        />

        <SectionCard
          title="Summary Cards"
          body={
            <ul className="flex flex-col gap-1 mt-1">
              <li><strong className="text-foreground">In Progress</strong> -- Leads currently active in a sequence</li>
              <li><strong className="text-foreground">Responded</strong> -- Leads who replied via email or LinkedIn</li>
              <li><strong className="text-foreground">Issue</strong> -- Leads with bounces, send failures, or unsubscribes</li>
              <li><strong className="text-foreground">Pending</strong> -- Leads in To Launch or not yet started in the sequence</li>
            </ul>
          }
        />

        <SectionCard
          title="Status Column"
          body={
            <>
              <p>Shows the latest action state for each lead in the campaign, based on the most recent event recorded by the platform.</p>
              <div className="mt-3 rounded-md border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium">Color</th>
                      <th className="px-3 py-2 text-left font-medium">Group</th>
                      <th className="px-3 py-2 text-left font-medium">Included States</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STATUS_COLOR_ROWS.map((row) => (
                      <tr key={row.meaning} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center justify-center rounded-full h-3 w-3 ${row.color}`} />
                        </td>
                        <td className="px-3 py-2 font-medium text-foreground">{row.meaning}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.states}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          }
        />

        <SectionCard
          title="Table Groups"
          body={
            <ul className="flex flex-col gap-2 mt-1">
              <li>
                <strong className="text-foreground">Launched</strong> -- Leads added to the campaign platform with an active sequence.
                Click to view lead details. Leads added manually on the platform show a <span className="inline-flex items-center rounded-full bg-purple-500 text-white text-[10px] px-1.5">No Match</span> badge and are not clickable.
              </li>
              <li>
                <strong className="text-foreground">To Launch</strong> -- Leads saved to the database via <code className="font-mono text-xs">/sdr:campaign_assign</code> but not yet added to the platform.
                Select with checkboxes, then use the Launch button. Click to preview messages and access the single-lead launch page.
              </li>
            </ul>
          }
        />

        <SectionCard
          title="Name, Company, and Title Display"
          body={
            <>
              Only leads added through the <code className="font-mono text-xs">/sdr:campaign_assign</code> skill show contact details.
              This skill stores the CRM Contact ID, so leads added directly on the platform display only their email address.
            </>
          }
        />

        <SectionCard
          title="Sequence"
          body="Shows how far the lead has progressed through the campaign steps. Example: 2/5 = completed step 2 of a 5-step campaign."
        />
      </div>
    </div>
  );
}

// --- Profile Analysis ---

function ProfileAnalysisTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold">Overview</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Displays all contacts from the CRM database alongside their campaign status.
          All contacts are shown regardless of campaign assignment, allowing you to track outreach progress per contact.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Filters"
          body={
            <ul className="flex flex-col gap-1 mt-1">
              <li><strong className="text-foreground">Top Tabs</strong> -- All / In Progress / Responded / Issue / Other / Unassigned group filter</li>
              <li><strong className="text-foreground">Campaign Select</strong> -- Filter contacts belonging to a specific campaign</li>
              <li><strong className="text-foreground">Min AI Score</strong> -- Show only contacts above the set score</li>
              <li><strong className="text-foreground">Search</strong> -- Search by name, company, title, or email</li>
            </ul>
          }
        />

        <SectionCard
          title="Status Column"
          body="Displays the current status of the most active campaign for each contact. If a contact belongs to multiple campaigns, the in-progress (blue) campaign is prioritized; otherwise the most recent campaign is used."
        />

        <SectionCard
          title="Unassigned"
          body={
            <>
              Contacts not yet added to any campaign.{" "}
              Run the <code className="font-mono text-xs">/sdr:select</code> {"->"}{" "}
              <code className="font-mono text-xs">/sdr:generate</code> {"->"}{" "}
              <code className="font-mono text-xs">/sdr:campaign_assign</code> flow to assign them.
            </>
          }
        />

        <SectionCard
          title="Sequence"
          body="Shows the lead's progress through the primary campaign steps. Unassigned contacts have no sequence data and show no progress."
        />

        <SectionCard
          title="Click Behavior"
          body={
            <ul className="flex flex-col gap-1 mt-1">
              <li><strong className="text-foreground">Unassigned contact click</strong> -- Opens the contact profile page (CRM info, AI analysis)</li>
              <li><strong className="text-foreground">Campaign-assigned contact click</strong> -- Opens the lead detail page (full campaign sequence view)</li>
            </ul>
          }
        />

        <div className="flex items-start gap-2 rounded-md bg-muted/50 px-4 py-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
          <p className="text-sm text-muted-foreground">
            The Sync button in Profile Analysis performs the same data sync as Campaign Analysis.
            Clicking Sync on either tab updates data for both views.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Lead Detail ---

function LeadDetailTab() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-base font-semibold">Overview</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Clicking a lead from Campaign Analysis or Profile Analysis opens the lead detail page.
          The view differs depending on whether the lead is Launched or To Launch.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard
          title="Launched Lead (Standard Mode)"
          body={
            <ul className="flex flex-col gap-2 mt-1">
              <li><strong className="text-foreground">Data Sync</strong> -- Fetches latest status and sequence data from the platform and updates the database.</li>
              <li><strong className="text-foreground">Message Sequence Edit</strong> -- Use the edit button (top-right) to modify message content and save.</li>
              <li>
                <strong className="text-foreground">Unapplied Changes Banner</strong> -- After saving edits, an amber banner appears at the top.
                <ul className="mt-1 flex flex-col gap-1 pl-4">
                  <li><strong className="text-foreground">Apply Changes</strong> -- Pushes modified messages to the platform as custom variables.</li>
                  <li><strong className="text-foreground">Discard Changes</strong> -- Reverts edits and restores original platform data.</li>
                </ul>
              </li>
            </ul>
          }
        />

        <SectionCard
          title="To Launch Lead (Pending Mode)"
          body={
            <ul className="flex flex-col gap-2 mt-1">
              <li>Clicking a lead from the To Launch section in Campaign Analysis opens it in Pending mode.</li>
              <li><strong className="text-foreground">Launch Button</strong> -- Displayed on the campaign status card (right side). Clicking adds the lead to the platform, runs auto-sync, and navigates to the Launched lead detail page.</li>
              <li>In Pending mode, the unapplied changes banner, Apply Changes, and Discard Changes are not shown.</li>
            </ul>
          }
        />

        <SectionCard
          title="Left Panel -- Background Info"
          body={
            <ul className="flex flex-col gap-1 mt-1">
              <li>Name, country, company, title, email, LinkedIn URL</li>
              <li>Experience (displayed as structured data when parseable, otherwise plain text)</li>
              <li>About section</li>
            </ul>
          }
        />

        <SectionCard
          title="Left Panel -- AI Analysis"
          body="Shows the AI score (0-10), scoring rationale, and a summary of recent interests/interactions. Data is only displayed for contacts with completed AI analysis in the CRM."
        />

        <SectionCard
          title="Left Panel -- Activity Log"
          body="Displays the chronological event history recorded by the platform. Includes email sends, opens, and replies, as well as LinkedIn visits, messages, and connection accepts."
        />

        <SectionCard
          title="Right Panel -- Message Sequence"
          body={
            <ul className="flex flex-col gap-2 mt-1">
              <li>Shows the email sequence if the lead has an email address, otherwise the LinkedIn sequence.</li>
              <li>Already-sent steps are marked with a blue vertical bar and a <strong className="text-foreground">Sent</strong> indicator.</li>
              <li>Branch sequences are shown as active or inactive based on whether an email reply was received.</li>
              <li>Click the arrow on each step to expand and view the message body.</li>
            </ul>
          }
        />
      </div>
    </div>
  );
}

// --- Main ---

export function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Guide</h2>
      </div>

      <Tabs defaultValue="skill-guide">
        <TabsList className="mb-6">
          <TabsTrigger value="skill-guide">Skill Guide</TabsTrigger>
          <TabsTrigger value="campaign-analysis">Campaign Analysis</TabsTrigger>
          <TabsTrigger value="profile-analysis">Profile Analysis</TabsTrigger>
          <TabsTrigger value="lead-detail">Profile Details</TabsTrigger>
        </TabsList>

        <TabsContent value="skill-guide">
          <SkillGuideTab />
        </TabsContent>
        <TabsContent value="campaign-analysis">
          <CampaignAnalysisTab />
        </TabsContent>
        <TabsContent value="profile-analysis">
          <ProfileAnalysisTab />
        </TabsContent>
        <TabsContent value="lead-detail">
          <LeadDetailTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
