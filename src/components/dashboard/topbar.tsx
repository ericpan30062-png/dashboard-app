"use client";

import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { MobileNav } from "./mobile-nav";
import { navItems } from "./nav-items";

export function Topbar() {
  const pathname = usePathname();
  const title =
    [...navItems].reverse().find((item) => pathname.startsWith(item.href))
      ?.label ?? "Dashboard";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <h1 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          {title}
        </h1>
      </div>
      <UserButton />
    </header>
  );
}
