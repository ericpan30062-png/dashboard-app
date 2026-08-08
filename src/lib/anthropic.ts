import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// Anthropic usage is per-user (a personal API key the user generates in
// their own Anthropic Console account) — stored on Integration like Canvas's
// token, so nobody spends the app owner's credits. See
// src/components/dashboard/anthropic-connection.tsx for the Settings UI.
export async function getAnthropicClientForUser(
  userId: string,
): Promise<Anthropic | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: "ANTHROPIC" } },
  });
  if (!integration?.accessToken) return null;

  return new Anthropic({ apiKey: integration.accessToken });
}

// Hits a cheap authenticated endpoint to confirm the key actually works
// before saving it.
export async function verifyAnthropicKey(apiKey: string): Promise<boolean> {
  try {
    await new Anthropic({ apiKey }).models.list();
    return true;
  } catch {
    return false;
  }
}
