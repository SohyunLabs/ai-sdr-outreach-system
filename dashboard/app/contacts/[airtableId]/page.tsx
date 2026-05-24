import { notFound } from "next/navigation";
import { getContactProfile, getLastSync } from "@/lib/lead-data";
import { ContactProfileShell } from "./contact-profile-shell";

export const dynamic = "force-dynamic";

function parseExperiences(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default async function ContactProfilePage({
  params,
}: {
  params: Promise<{ airtableId: string }>;
}) {
  const { airtableId } = await params;
  const [profile, lastSyncAt] = await Promise.all([
    getContactProfile(airtableId),
    getLastSync(),
  ]);
  if (!profile) notFound();
  const parsedExperiences = parseExperiences(profile.experiences ?? null);
  return <ContactProfileShell profile={profile} parsedExperiences={parsedExperiences} lastSyncAt={lastSyncAt} />;
}
