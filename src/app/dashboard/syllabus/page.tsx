import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { SyllabusUploader } from "@/components/dashboard/syllabus-uploader";
import { SavedAssignments } from "@/components/dashboard/saved-assignments";

export default async function SyllabusPage() {
  await auth.protect();
  const user = await getOrCreateUser();

  const assignments = user
    ? await prisma.assignment.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const canvasConnected = Boolean(
    user?.integrations.find((i) => i.provider === "CANVAS")?.connectedAt,
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Upload a syllabus
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          We extract assignments, due dates, and grade weights with Claude —
          review and fix anything before it&apos;s saved.
        </p>
      </div>

      <SyllabusUploader />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Saved assignments
        </h2>
        <SavedAssignments assignments={assignments} canvasConnected={canvasConnected} />
      </div>
    </div>
  );
}
