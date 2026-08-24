import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Looks up the signed-in Clerk user in our database, creating the row on
 * first visit. Call this from server components/actions that need a local
 * User id to attach app data (e.g. Integration rows) to.
 */
export async function getOrCreateUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";

  return prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      email,
      name: clerkUser.fullName,
      imageUrl: clerkUser.imageUrl,
    },
    create: {
      clerkId: clerkUser.id,
      email,
      name: clerkUser.fullName,
      imageUrl: clerkUser.imageUrl,
    },
    include: { integrations: true },
  });
}

// AppConfig (the Google OAuth client) is app-wide, not per-user — so unlike
// everything else in Settings, changing it needs to be gated to someone
// specific rather than "any signed-in user". This app has no dedicated
// admin/role field; the simplest correct owner is whoever's account
// existed first, so that's what's checked here instead of adding a role
// column for an app that, by design, has exactly one owner.
export async function isAppOwner(userId: string): Promise<boolean> {
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  return firstUser?.id === userId;
}
