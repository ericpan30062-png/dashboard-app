import type { OAuth2Client } from "google-auth-library";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Encodes a minimal RFC 2822 message and sends it via the Gmail API. Uses
// the same Google OAuth connection as Calendar (see the SCOPES comment in
// google-calendar.ts) rather than a separate Gmail-specific integration.
export async function sendEmail(
  client: OAuth2Client,
  message: { to: string; subject: string; body: string },
): Promise<void> {
  const { token } = await client.getAccessToken();

  const mime =
    `To: ${message.to}\r\n` +
    `Subject: ${message.subject}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n` +
    `MIME-Version: 1.0\r\n\r\n` +
    message.body;

  const res = await fetch(`${GMAIL_API_BASE}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: toBase64Url(mime) }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gmail send failed: ${res.status} ${detail}`);
  }
}
