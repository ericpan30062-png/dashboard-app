import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";

export const runtime = "nodejs";

export async function POST() {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  await prisma.integration.deleteMany({
    where: { userId: user.id, provider: "GOOGLE_CALENDAR" },
  });

  return NextResponse.json({ ok: true });
}
