import { Calendar } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default async function CalendarPage() {
  await auth.protect();
  return (
    <PlaceholderPage
      icon={Calendar}
      title="Google Calendar"
      description="Wire up the Google Calendar API here to show upcoming events and let users manage their schedule without leaving the dashboard."
      envVars={[
        "GOOGLE_CALENDAR_CLIENT_ID",
        "GOOGLE_CALENDAR_CLIENT_SECRET",
        "GOOGLE_CALENDAR_REDIRECT_URI",
      ]}
    />
  );
}
