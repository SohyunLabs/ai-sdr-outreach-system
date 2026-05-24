import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SDR_SPREADSHEET_ID!.trim();
const SHEET_NAME = "AllowedEmails_SDR";

async function getSheetsClient() {
  const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!, "base64").toString());
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function getAllowedRows(sheets: Awaited<ReturnType<typeof getSheetsClient>>) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });
  return res.data.values ?? [];
}

async function checkAllowedEmail(email: string): Promise<boolean> {
  const sheets = await getSheetsClient();
  const rows = await getAllowedRows(sheets);
  const emails = rows.map((r) => r[0]?.toLowerCase() ?? "");
  return emails.includes(email.toLowerCase());
}

async function getEmailPermission(email: string): Promise<string | null> {
  const sheets = await getSheetsClient();
  const rows = await getAllowedRows(sheets);
  const row = rows.find((r) => r[0]?.toLowerCase() === email.toLowerCase());
  return row?.[2] ?? null;
}

async function updateLastLogin(email: string): Promise<void> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:C`,
  });
  const rows = res.data.values ?? [];
  const rowIndex = rows.findIndex(
    (row) => row[0]?.toLowerCase() === email.toLowerCase()
  );
  if (rowIndex === -1) return;

  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!D${rowIndex + 1}`,
    valueInputOption: "RAW",
    requestBody: { values: [[now]] },
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID?.trim(),
      clientSecret: process.env.AUTH_GOOGLE_SECRET?.trim(),
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      try {
        const allowed = await checkAllowedEmail(user.email);
        if (!allowed) return false;
        updateLastLogin(user.email).catch(console.error);
        return true;
      } catch (err: unknown) {
        const e = err as Record<string, unknown>;
        console.error("[E]" + String(e?.message).slice(0, 200));
        console.error("[C]" + String(e?.code));
        console.error("[S]" + String(e?.status));
        return false;
      }
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.role = await getEmailPermission(user.email);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
      }
      return session;
    },
  },
});
