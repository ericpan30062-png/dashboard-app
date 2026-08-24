import { NextResponse } from "next/server";
import { runProcrastinationNudgeCheck } from "@/lib/procrastination-nudge-job";
import { timingSafeEqualStrings } from "@/lib/timing-safe-equal";

export const runtime = "nodejs";
export const maxDuration = 300;

// Meant to be hit once a day (e.g. 8am) by an external scheduler (Vercel
// Cron, a local cron/launchd entry, GitHub Actions, etc. — see the
// README), not by a signed-in user, so this checks a shared secret instead
// of auth.protect() — same CRON_SECRET as GET /api/cron/exam-plans. Vercel
// Cron sends the secret as `Authorization: Bearer <CRON_SECRET>`; a
// `?secret=` query param is also accepted for easy manual/local triggering.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  const queryToken = new URL(request.url).searchParams.get("secret");
  const provided = bearerToken ?? queryToken;

  if (!provided || !timingSafeEqualStrings(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runProcrastinationNudgeCheck();
  return NextResponse.json(result);
}
