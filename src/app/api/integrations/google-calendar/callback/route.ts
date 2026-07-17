import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const STATE_COOKIE = "gcal_oauth_state";

export async function GET(request: Request) {
  await auth.protect();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const redirectTo = (status: string) =>
    NextResponse.redirect(
      new URL(`/dashboard/calendar?status=${status}`, url.origin),
    );

  if (errorParam) return redirectTo("denied");
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectTo("invalid_state");
  }

  const user = await getOrCreateUser();
  if (!user) return redirectTo("error");

  try {
    const tokens = await exchangeCodeForTokens(code);

    const existing = await prisma.integration.findUnique({
      where: {
        userId_provider: { userId: user.id, provider: "GOOGLE_CALENDAR" },
      },
    });

    // Google only returns a refresh_token on first consent (or when we
    // force prompt=consent, as connect/route.ts does) — fall back to the
    // previously stored one so a routine re-auth doesn't wipe it out.
    const refreshToken = tokens.refresh_token ?? existing?.refreshToken ?? null;
    if (!refreshToken) {
      return redirectTo("no_refresh_token");
    }

    await prisma.integration.upsert({
      where: {
        userId_provider: { userId: user.id, provider: "GOOGLE_CALENDAR" },
      },
      create: {
        userId: user.id,
        provider: "GOOGLE_CALENDAR",
        accessToken: tokens.access_token ?? null,
        refreshToken,
        connectedAt: new Date(),
      },
      update: {
        accessToken: tokens.access_token ?? undefined,
        refreshToken,
        connectedAt: new Date(),
      },
    });

    return redirectTo("connected");
  } catch (error) {
    console.error("Google Calendar callback failed:", error);
    return redirectTo("error");
  }
}
