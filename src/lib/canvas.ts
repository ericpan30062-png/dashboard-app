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
