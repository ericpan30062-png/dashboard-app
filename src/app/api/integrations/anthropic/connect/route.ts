import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { verifyAnthropicKey } from "@/lib/anthropic";

export const runtime = "nodejs";

const ConnectSchema = z.object({
  apiKey: z.string().min(1),
});

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { apiKey } = parsed.data;
  const valid = await verifyAnthropicKey(apiKey);
  if (!valid) {
    return NextResponse.json(
      { error: "Couldn't verify that API key — double check it." },
      { status: 400 },
    );
  }

  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: "ANTHROPIC" } },
    create: {
      userId: user.id,
      provider: "ANTHROPIC",
      accessToken: apiKey,
      connectedAt: new Date(),
    },
    update: {
      accessToken: apiKey,
      connectedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
