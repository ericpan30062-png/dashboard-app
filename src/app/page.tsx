import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-xl flex-col items-center gap-8 px-6 py-32 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Your dashboard
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Sign in to view your calendar, courses, notes, and AI assistant in
          one place.
        </p>
        <div className="flex gap-4">
          <Link
            href="/sign-in"
            className="flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="flex h-12 items-center justify-center rounded-full border border-zinc-950/[.1] px-6 text-base font-medium text-zinc-950 transition-colors hover:bg-zinc-950/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.06]"
          >
            Sign up
          </Link>
        </div>
      </main>
    </div>
  );
}
