import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getNotionCredentials, updateNote, archiveNote } from "@/lib/notion";

export const runtime = "nodejs";

const NoteSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const creds = await getNotionCredentials(user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "Notion isn't connected.", needsNotionConnect: true },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = NoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { id } = await params;

  try {
    const note = await updateNote(creds, id, parsed.data);
    return NextResponse.json({ note });
  } catch (error) {
    console.error("updateNote failed:", error);
    return NextResponse.json({ error: "Couldn't update the note." }, { status: 502 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const creds = await getNotionCredentials(user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "Notion isn't connected.", needsNotionConnect: true },
      { status: 400 },
    );
  }

  const { id } = await params;

  try {
    await archiveNote(creds, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("archiveNote failed:", error);
    return NextResponse.json({ error: "Couldn't delete the note." }, { status: 502 });
  }
}
