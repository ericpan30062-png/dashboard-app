import { Sparkles } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default async function AssistantPage() {
  await auth.protect();
  return (
    <PlaceholderPage
      icon={Sparkles}
      title="AI Assistant"
      description="Wire up a Claude-based assistant here that can answer questions using the user's calendar, courses, and notes — reuse getAnthropicClientForUser() from src/lib/anthropic.ts for the per-user key already connected on Settings, rather than a new env var."
      envVars={[]}
    />
  );
}
