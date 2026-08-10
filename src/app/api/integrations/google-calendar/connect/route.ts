import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { getGoogleAuthUrl } from "@/lib/google-calendar";

export const runtime = "nodejs";

const STATE_COOKIE = "gcal_oauth_state";

export async function GET(request: Request) {
  await auth.protect();

  const state = crypto.randomUUID();

  let authUrl: string;
  try {
    authUrl = await getGoogleAuthUrl(state);
  } catch (error) {
    console.error("Google Calendar connect failed:", error);
    return NextResponse.redirect(
      new URL("/dashboard/calendar?status=not_configured", request.url),
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(authUrl);
}
