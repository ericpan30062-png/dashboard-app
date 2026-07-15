import { Sparkles } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { PlaceholderPage } from "@/components/dashboard/placeholder-page";

export default async function AssistantPage() {
  await auth.protect();
  return (
    <PlaceholderPage
      icon={Sparkles}
      title="AI Assistant"
      description="Wire up the Anthropic API here to power a Claude-based assistant that can answer questions using the user's calendar, courses, and notes."
      envVars={["ANTHROPIC_API_KEY"]}
    />
  );
}
