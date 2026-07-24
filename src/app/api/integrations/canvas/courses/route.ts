import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getCanvasCredentials, listCanvasCourses } from "@/lib/canvas";

export const runtime = "nodejs";

export async function GET() {
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

  try {
    const courses = await listCanvasCourses(creds);
    return NextResponse.json({ courses });
  } catch (error) {
    console.error("listCanvasCourses failed:", error);
    return NextResponse.json(
      { error: "Couldn't fetch your Canvas courses." },
      { status: 502 },
    );
  }
}
