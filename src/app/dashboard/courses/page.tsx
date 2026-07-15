import { GraduationCap } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default async function CoursesPage() {
  await auth.protect();
  return (
    <PlaceholderPage
      icon={GraduationCap}
      title="Canvas LMS"
      description="Wire up the Canvas LMS API here to pull in courses, assignments, and due dates for the signed-in user."
      envVars={["CANVAS_API_URL", "CANVAS_API_KEY"]}
    />
  );
}
