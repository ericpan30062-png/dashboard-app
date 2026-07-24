import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import {
  getCanvasCredentials,
  listCanvasCourses,
  getCourseSyllabus,
} from "@/lib/canvas";
import { extractOfficeHours } from "@/lib/office-hours-extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  await auth.protect();
  const user = await getOrCreateUser();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  const creds = await getCanvasCredentials(user.id);
  if (!creds) {
    return NextResponse.json(
      { error: "Canvas isn't connected.", needsCanvasConnect: true },
      { status: 400 },
    );
  }

  let courses;
  try {
    courses = await listCanvasCourses(creds);
  } catch (error) {
    console.error("listCanvasCourses failed:", error);
    return NextResponse.json(
      { error: "Couldn't fetch your Canvas courses." },
      { status: 502 },
    );
  }

  let importedCount = 0;
  const failedCourses: string[] = [];

  for (const course of courses) {
    try {
      const { name, syllabusText } = await getCourseSyllabus(creds, course.id);
      if (!syllabusText) continue;

      const entries = await extractOfficeHours(name, syllabusText);
      for (const entry of entries) {
        // Avoid piling up duplicates on repeated imports: treat course +
        // instructor + day + start time as the natural key.
        const existing = await prisma.officeHours.findFirst({
          where: {
            userId: user.id,
            course: name,
            instructorName: entry.instructorName,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
          },
        });
        if (existing) continue;

        await prisma.officeHours.create({
          data: {
            userId: user.id,
            course: name,
            instructorName: entry.instructorName,
            instructorEmail: entry.instructorEmail,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            location: entry.location,
            source: "canvas",
          },
        });
        importedCount += 1;
      }
    } catch (error) {
      console.error(`Office hours import failed for course ${course.name}:`, error);
      failedCourses.push(course.name);
    }
  }

  return NextResponse.json({ importedCount, failedCourses });
}
