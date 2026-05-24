export async function POST() {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return Response.json({ error: "N8N_WEBHOOK_URL not configured" }, { status: 500 });
  }
  try {
    await fetch(webhookUrl, { method: "POST" });
    return Response.json({ triggered: true }, { status: 202 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
}
