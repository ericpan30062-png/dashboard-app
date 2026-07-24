import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { CanvasConnection } from "@/components/dashboard/canvas-connection";

export default async function CoursesPage() {
  await auth.protect();
  const user = await getOrCreateUser();
  const integration = user?.integrations.find((i) => i.provider === "CANVAS");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Canvas LMS
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect Canvas so the study session sizer can pull in a course&apos;s
          module topics when estimating how long an assignment will take.
        </p>
      </div>

      <CanvasConnection connected={Boolean(integration?.connectedAt)} />
    </div>
  );
}
