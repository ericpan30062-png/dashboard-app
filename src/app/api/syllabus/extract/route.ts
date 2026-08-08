import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClientForUser } from "@/lib/anthropic";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { ExtractedAssignmentsSchema } from "@/lib/syllabus-schema";

export const runtime = "nodejs";
// PDF extraction + a Claude call can take a while on a long syllabus.
export const maxDuration = 60;

const MAX_FILE_BYTES = 20 * 1024 * 1024;

const SYSTEM_PROMPT = `You extract graded assignments from a course syllabus.

Find every exam, paper, homework assignment, and project mentioned, and classify each into exactly one type: EXAM, PAPER, HOMEWORK, or PROJECT.

For each one, report:
- name: a short, human-readable title (e.g. "Midterm Exam", "Problem Set 3").
- dueDate: prefer YYYY-MM-DD if the syllabus gives a specific calendar date. If it only gives something like "Week 5" or "TBD", copy that wording as-is. Use null if no date is stated at all.
- weight: the grade weight as a plain percentage number (e.g. 25 for "25%"). Use null if no weight is stated.
- type: EXAM, PAPER, HOMEWORK, or PROJECT — pick the closest match.

Do not invent values that aren't in the text. Use null when something genuinely isn't stated rather than guessing.`;

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const anthropic = await getAnthropicClientForUser(user.id);
  if (!anthropic) {
    return NextResponse.json(
      { error: "Connect your Anthropic API key on Settings first.", needsAnthropicConnect: true },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds the 20MB limit" },
      { status: 413 },
    );
  }

  const extractorUrl = process.env.PDF_EXTRACTOR_URL;
  if (!extractorUrl) {
    return NextResponse.json(
      { error: "PDF_EXTRACTOR_URL is not configured on the server" },
      { status: 500 },
    );
  }

  const forwardForm = new FormData();
  forwardForm.append("file", file, file.name);

  const sharedSecret = process.env.PDF_EXTRACTOR_SHARED_SECRET;
  const extractRes = await fetch(new URL("/extract", extractorUrl), {
    method: "POST",
    body: forwardForm,
    headers: sharedSecret ? { "X-Shared-Secret": sharedSecret } : undefined,
  });

  if (!extractRes.ok) {
    const detail = await extractRes
      .json()
      .then((body) => body?.detail)
      .catch(() => null);
    return NextResponse.json(
      { error: detail ?? "PDF extraction failed" },
      { status: 502 },
    );
  }

  const { text } = (await extractRes.json()) as { text: string };

  const message = await anthropic.messages.parse({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      { role: "user", content: `Syllabus text:\n\n${text}` },
    ],
    output_config: {
      format: zodOutputFormat(ExtractedAssignmentsSchema),
    },
  });

  if (!message.parsed_output) {
    return NextResponse.json(
      { error: "Claude did not return a parseable result" },
      { status: 502 },
    );
  }

  return NextResponse.json({ assignments: message.parsed_output.assignments });
}
