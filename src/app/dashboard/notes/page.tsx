import { NotebookText } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default async function NotesPage() {
  await auth.protect();
  return (
    <PlaceholderPage
      icon={NotebookText}
      title="Notion"
      description="Wire up the Notion API here to read and write pages/databases so notes stay in sync with a connected Notion workspace."
      envVars={["NOTION_API_KEY", "NOTION_DATABASE_ID"]}
    />
  );
}
