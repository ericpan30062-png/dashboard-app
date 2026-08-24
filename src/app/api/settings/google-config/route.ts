import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser, isAppOwner } from "@/lib/clerk-sync";

export const runtime = "nodejs";

const BodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().min(1),
});

export async function POST(request: Request) {
  await auth.protect();

  // This config is shared app-wide (every user's Calendar/Gmail OAuth
  // flow goes through it), so unlike the per-user integrations on this
  // page, it can't be left open to any signed-in account — otherwise a
  // second user could point it at a Google OAuth client they control.
  const user = await getOrCreateUser();
  if (!user || !(await isAppOwner(user.id))) {
    return NextResponse.json(
      { error: "Only the app owner can update the Google OAuth client." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await prisma.appConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      googleCalendarClientId: parsed.data.clientId,
      googleCalendarClientSecret: parsed.data.clientSecret,
      googleCalendarRedirectUri: parsed.data.redirectUri,
    },
    update: {
      googleCalendarClientId: parsed.data.clientId,
      googleCalendarClientSecret: parsed.data.clientSecret,
      googleCalendarRedirectUri: parsed.data.redirectUri,
    },
  });

  return NextResponse.json({ ok: true });
}
