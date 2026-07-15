import type { LucideIcon } from "lucide-react";

export function PlaceholderPage({
  icon: Icon,
  title,
  description,
  envVars,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  envVars: string[];
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 rounded-xl border border-dashed border-zinc-300 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900">
        <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-400" strokeWidth={1.75} />
      </div>
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      <div className="w-full rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          Required environment variables
        </p>
        <ul className="flex flex-col gap-1 font-mono text-xs text-zinc-700 dark:text-zinc-300">
          {envVars.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
