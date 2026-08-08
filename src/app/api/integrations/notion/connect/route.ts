import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { verifyAndPrepareNotionDatabase } from "@/lib/notion";

export const runtime = "nodejs";

const ConnectSchema = z.object({
  token: z.string().min(1),
  databaseId: z.string().min(1),
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

  const { token, databaseId } = parsed.data;
  const prepared = await verifyAndPrepareNotionDatabase(token, databaseId);
  if (!prepared) {
    return NextResponse.json(
      {
        error:
          "Couldn't verify that database — check the ID and make sure you shared it with your integration.",
      },
      { status: 400 },
    );
  }

  await prisma.integration.upsert({
    where: { userId_provider: { userId: user.id, provider: "NOTION" } },
    create: {
      userId: user.id,
      provider: "NOTION",
      accessToken: token,
      metadata: { databaseId, titleProperty: prepared.titleProperty },
      connectedAt: new Date(),
    },
    update: {
      accessToken: token,
      metadata: { databaseId, titleProperty: prepared.titleProperty },
      connectedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
