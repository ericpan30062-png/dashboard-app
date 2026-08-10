import { Calendar, GraduationCap, NotebookText, Sparkles } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { prisma } from "@/lib/prisma";
import { SemesterStartDate } from "@/components/dashboard/semester-start-date";
import { NotificationSettings } from "@/components/dashboard/notification-settings";
import { AnthropicConnection } from "@/components/dashboard/anthropic-connection";
import { GoogleAppConfig } from "@/components/dashboard/google-app-config";
import type { IntegrationProvider } from "@/generated/prisma/enums";

const providerMeta: Record<
  IntegrationProvider,
  { label: string; icon: typeof Calendar }
> = {
  GOOGLE_CALENDAR: { label: "Google Calendar", icon: Calendar },
  CANVAS: { label: "Canvas LMS", icon: GraduationCap },
  NOTION: { label: "Notion", icon: NotebookText },
  ANTHROPIC: { label: "Anthropic API key", icon: Sparkles },
};

export default async function SettingsPage() {
  await auth.protect();
  const user = await getOrCreateUser();
  const appConfig = await prisma.appConfig.findUnique({ where: { id: "singleton" } });

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
        <h2 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Anthropic API key
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Powers every Claude feature in this app — syllabus upload, study
          plans, nudges, and more — billed to your own Anthropic account.
        </p>
        <AnthropicConnection
          connected={Boolean(
            user?.integrations.some(
              (i) => i.provider === "ANTHROPIC" && i.connectedAt,
            ),
          )}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Google OAuth client
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Unlike everything else on this page, this is shared app-wide, not
          per-user — it&apos;s this app instance&apos;s one-time registration
          with Google (Calendar + Gmail), the same way Clerk&apos;s keys
          work. Every user still connects and consents individually on the
          Calendar page.
        </p>
        <GoogleAppConfig
          configured={Boolean(
            appConfig?.googleCalendarClientId &&
              appConfig?.googleCalendarClientSecret &&
              appConfig?.googleCalendarRedirectUri,
          )}
          initialClientId={appConfig?.googleCalendarClientId ?? null}
          initialRedirectUri={appConfig?.googleCalendarRedirectUri ?? null}
        />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Study session sizer
        </h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Used to tell Claude how far into the semester an assignment falls
          when estimating study time. Optional — the sizer still works
          without it.
        </p>
        <SemesterStartDate initialDate={user?.semesterStartDate ?? null} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Notifications
        </h2>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-900">
          <NotificationSettings
            initialProcrastinationNudgesEnabled={
              user?.procrastinationNudgesEnabled ?? true
            }
          />
        </div>
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
