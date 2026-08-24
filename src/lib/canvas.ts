import { prisma } from "@/lib/prisma";

export type CanvasCredentials = { baseUrl: string; token: string };

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

// Canvas credentials are per-user (a personal access token the user
// generates in their own Canvas account, plus their school's Canvas
// domain) — stored on Integration like Google Calendar's tokens, but
// there's no OAuth flow here since Canvas personal access tokens are
// just pasted in directly.
export async function getCanvasCredentials(
  userId: string,
): Promise<CanvasCredentials | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: "CANVAS" } },
  });
  if (!integration?.accessToken) return null;

  const metadata = integration.metadata as { baseUrl?: string } | null;
  if (!metadata?.baseUrl) return null;

  return { baseUrl: metadata.baseUrl, token: integration.accessToken };
}

// Hits a cheap authenticated endpoint to confirm the base URL + token
// actually work together before saving them.
export async function verifyCanvasCredentials(
  baseUrl: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/users/self`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type CanvasCourse = { id: string; name: string };

export async function listCanvasCourses(
  creds: CanvasCredentials,
): Promise<CanvasCourse[]> {
  const res = await fetch(
    `${normalizeBaseUrl(creds.baseUrl)}/api/v1/courses?enrollment_state=active&per_page=100`,
    { headers: { Authorization: `Bearer ${creds.token}` } },
  );
  if (!res.ok) {
    throw new Error(`Canvas list courses failed: ${res.status}`);
  }

  const body = (await res.json()) as Array<{ id: number; name?: string }>;
  return body
    .filter((c): c is { id: number; name: string } => Boolean(c.name))
    .map((c) => ({ id: String(c.id), name: c.name }));
}

export type CanvasAssignment = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  // null when Canvas has no due date set for the assignment (e.g. an
  // ungraded discussion) — callers should treat that as "undated", not
  // filter it out by accident.
  dueAt: string | null;
  htmlUrl: string | null;
};

async function listCourseAssignments(
  creds: CanvasCredentials,
  course: CanvasCourse,
): Promise<CanvasAssignment[]> {
  const res = await fetch(
    `${normalizeBaseUrl(creds.baseUrl)}/api/v1/courses/${course.id}/assignments?per_page=100&order_by=due_at`,
    { headers: { Authorization: `Bearer ${creds.token}` } },
  );
  if (!res.ok) {
    throw new Error(`Canvas list assignments failed: ${res.status}`);
  }

  const body = (await res.json()) as Array<{
    id: number;
    name?: string;
    due_at?: string | null;
    html_url?: string | null;
  }>;
  return body
    .filter((a): a is { id: number; name: string; due_at?: string | null; html_url?: string | null } =>
      Boolean(a.name),
    )
    .map((a) => ({
      id: String(a.id),
      courseId: course.id,
      courseName: course.name,
      name: a.name,
      dueAt: a.due_at ?? null,
      htmlUrl: a.html_url ?? null,
    }));
}

export function formatCanvasDueDate(dueAt: string | null): string {
  if (!dueAt) return "No due date";
  const date = new Date(dueAt);
  const datePart = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

// Canvas has no single "all my assignments across courses" endpoint, so
// this fans out one request per course (in parallel) and flattens the
// results — fine at student-scale course counts.
export async function listAllCanvasAssignments(
  creds: CanvasCredentials,
  courses: CanvasCourse[],
): Promise<CanvasAssignment[]> {
  const perCourse = await Promise.all(
    courses.map((course) => listCourseAssignments(creds, course)),
  );
  return perCourse.flat();
}

// A "topic" here is a Canvas Module's name (e.g. "Module 3: Photosynthesis")
// — the closest built-in Canvas concept to a syllabus topic list.
export async function listCourseModuleTopics(
  creds: CanvasCredentials,
  courseId: string,
): Promise<string[]> {
  const res = await fetch(
    `${normalizeBaseUrl(creds.baseUrl)}/api/v1/courses/${courseId}/modules?per_page=100`,
    { headers: { Authorization: `Bearer ${creds.token}` } },
  );
  if (!res.ok) {
    throw new Error(`Canvas list modules failed: ${res.status}`);
  }

  const body = (await res.json()) as Array<{ name?: string }>;
  return body.map((m) => m.name).filter((name): name is string => Boolean(name));
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// Canvas has no dedicated "office hours" API — instructors who publish them
// typically do so in the course syllabus body (free HTML text), so that's
// what office-hours-extractor.ts asks Claude to read.
export async function getCourseSyllabus(
  creds: CanvasCredentials,
  courseId: string,
): Promise<{ name: string; syllabusText: string | null }> {
  const res = await fetch(
    `${normalizeBaseUrl(creds.baseUrl)}/api/v1/courses/${courseId}?include[]=syllabus_body`,
    { headers: { Authorization: `Bearer ${creds.token}` } },
  );
  if (!res.ok) {
    throw new Error(`Canvas get course failed: ${res.status}`);
  }

  const body = (await res.json()) as { name?: string; syllabus_body?: string | null };
  const syllabusText = body.syllabus_body ? stripHtml(body.syllabus_body) : null;
  return { name: body.name ?? "Untitled course", syllabusText: syllabusText || null };
}
