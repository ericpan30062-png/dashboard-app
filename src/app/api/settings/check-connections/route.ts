import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { verifyGoogleCalendarConnection } from "@/lib/google-calendar";
import { verifyCanvasConnection } from "@/lib/canvas";
import { verifyNotionConnection } from "@/lib/notion";
import type { IntegrationProvider } from "@/generated/prisma/enums";

export const runtime = "nodejs";

// Live re-checks — not expiration lookups. None of these three providers
// expose a usable "this token expires on X" via their API (Notion tokens
// don't expire, Canvas personal access tokens don't return their expiry,
// and Google's refresh token has no fixed lifetime), so "still works as of
// this check" is what actually gets tracked. See Integration.lastVerifiedAt
// / lastVerifiedOk in the schema.
const CHECKERS: Partial<Record<IntegrationProvider, (userId: string) => Promise<boolean>>> = {
  GOOGLE_CALENDAR: verifyGoogleCalendarConnection,
  CANVAS: verifyCanvasConnection,
  NOTION: verifyNotionConnection,
};

export async function POST() {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const results: Partial<Record<IntegrationProvider, boolean>> = {};

  for (const [provider, check] of Object.entries(CHECKERS) as [
    IntegrationProvider,
    (userId: string) => Promise<boolean>,
  ][]) {
    const integration = user.integrations.find(
      (i) => i.provider === provider && i.connectedAt,
    );
    if (!integration) continue;

    const ok = await check(user.id);
    results[provider] = ok;

    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastVerifiedAt: new Date(), lastVerifiedOk: ok },
    });
  }

  return NextResponse.json({ results });
}
