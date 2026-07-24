import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";

export const runtime = "nodejs";

const DayOfWeekEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const CreateSchema = z.object({
  course: z.string().min(1),
  instructorName: z.string().min(1),
  instructorEmail: z.string().nullable().optional(),
  dayOfWeek: DayOfWeekEnum,
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().min(1),
});

export async function GET() {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ officeHours: [] });
  }

  const officeHours = await prisma.officeHours.findMany({
    where: { userId: user.id },
    orderBy: [{ course: "asc" }, { dayOfWeek: "asc" }],
  });

  return NextResponse.json({ officeHours });
}

export async function POST(request: Request) {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const created = await prisma.officeHours.create({
    data: {
      userId: user.id,
      course: parsed.data.course,
      instructorName: parsed.data.instructorName,
      instructorEmail: parsed.data.instructorEmail || null,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      location: parsed.data.location,
      source: "manual",
    },
  });

  return NextResponse.json({ officeHours: created });
}
