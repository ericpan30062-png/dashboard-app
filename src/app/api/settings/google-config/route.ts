import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const BodySchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().min(1),
});

export async function POST(request: Request) {
  await auth.protect();

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
