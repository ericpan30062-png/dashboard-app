import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getNotionCredentials, listNotes, createNote } from "@/lib/notion";

export const runtime = "nodejs";

const NoteSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(2000),
});

export async function GET() {
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

  try {
    const notes = await listNotes(creds);
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("listNotes failed:", error);
    return NextResponse.json({ error: "Couldn't fetch your notes." }, { status: 502 });
  }
}

export async function POST(request: Request) {
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

  try {
    const note = await createNote(creds, parsed.data);
    return NextResponse.json({ note });
  } catch (error) {
    console.error("createNote failed:", error);
    return NextResponse.json({ error: "Couldn't create the note." }, { status: 502 });
  }
}
