import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { verifyCanvasCredentials } from "@/lib/canvas";

export const runtime = "nodejs";

const ConnectSchema = z.object({
  baseUrl: z.string().min(1),
  token: z.string().min(1),
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

  const { baseUrl, token } = parsed.data;
  const valid = await verifyCanvasCredentials(baseUrl, token);
  if (!valid) {
    return NextResponse.json(
      { error: "Couldn't verify that Canvas URL and token together — double check both." },
      { status: 400 },
    );
  }

  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: "CANVAS" } },
    create: {
      userId: user.id,
      provider: "CANVAS",
      accessToken: token,
      metadata: { baseUrl },
      connectedAt: new Date(),
      lastVerifiedAt: new Date(),
      lastVerifiedOk: true,
    },
    update: {
      accessToken: token,
      metadata: { baseUrl },
      connectedAt: new Date(),
      lastVerifiedAt: new Date(),
      lastVerifiedOk: true,
    },
  });

  return NextResponse.json({ ok: true });
}
