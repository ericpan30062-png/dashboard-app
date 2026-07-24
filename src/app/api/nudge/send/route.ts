import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getAuthenticatedClient } from "@/lib/google-calendar";
import { sendEmail } from "@/lib/gmail";

export const runtime = "nodejs";
export const maxDuration = 30;

const BodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid recipient email, subject, and body." },
      { status: 400 },
    );
  }

  const client = await getAuthenticatedClient(user.id);
  if (!client) {
    return NextResponse.json(
      {
        error: "Connect Google first (Calendar page in the sidebar).",
        needsGoogleConnect: true,
      },
      { status: 400 },
    );
  }

  try {
    await sendEmail(client, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("sendEmail failed:", error);
    return NextResponse.json(
      { error: "Couldn't send the email — try again." },
      { status: 502 },
    );
  }
}
