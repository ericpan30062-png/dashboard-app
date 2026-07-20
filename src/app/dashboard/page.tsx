import Link from "next/link";
import { Calendar, GraduationCap, NotebookText, Sparkles } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { OverwhelmedButton } from "@/components/dashboard/overwhelmed-button";

const cards = [
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    description: "Upcoming events from Google Calendar.",
    icon: Calendar,
  },
  {
    href: "/dashboard/courses",
    label: "Courses",
    description: "Assignments and due dates from Canvas.",
    icon: GraduationCap,
  },
  {
    href: "/dashboard/notes",
    label: "Notes",
    description: "Pages synced with your Notion workspace.",
    icon: NotebookText,
  },
  {
    href: "/dashboard/assistant",
    label: "AI Assistant",
    description: "Ask Claude questions about your day.",
    icon: Sparkles,
  },
];

export default async function DashboardPage() {
  // Resource-based auth check — Clerk recommends protecting each page/
  // Server Function individually rather than relying on Middleware path
  // matching (see src/proxy.ts).
  await auth.protect();
  const user = await getOrCreateUser();
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
          {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Here&apos;s what&apos;s connected to your dashboard.
        </p>
      </div>

      <OverwhelmedButton />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
                <Icon
                  className="h-4 w-4 text-zinc-600 dark:text-zinc-400"
                  strokeWidth={1.75}
                />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {card.label}
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-500">
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
