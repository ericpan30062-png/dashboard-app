import { Calendar, GraduationCap, NotebookText } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import type { IntegrationProvider } from "@/generated/prisma/enums";

const providerMeta: Record<
  IntegrationProvider,
  { label: string; icon: typeof Calendar }
> = {
  GOOGLE_CALENDAR: { label: "Google Calendar", icon: Calendar },
  CANVAS: { label: "Canvas LMS", icon: GraduationCap },
  NOTION: { label: "Notion", icon: NotebookText },
};

export default async function SettingsPage() {
  await auth.protect();
  const user = await getOrCreateUser();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Account
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {user?.email ?? "—"}. This row is synced from Clerk into
          the local <code>User</code> table (see{" "}
          <code>src/lib/clerk-sync.ts</code>) so app data can reference it via
          Prisma.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Connected integrations
        </h2>
        <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
          {(Object.keys(providerMeta) as IntegrationProvider[]).map(
            (provider) => {
              const meta = providerMeta[provider];
              const Icon = meta.icon;
              const connected = user?.integrations.some(
                (i) => i.provider === provider && i.connectedAt,
              );

              return (
                <li
                  key={provider}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className="h-4 w-4 text-zinc-500"
                      strokeWidth={1.75}
                    />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                      {meta.label}
                    </span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      connected
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500"
                    }`}
                  >
                    {connected ? "Connected" : "Not connected"}
                  </span>
                </li>
              );
            },
          )}
        </ul>
      </div>
    </div>
  );
}
