"use client";

import { RedirectToSignIn, Show } from "@clerk/nextjs";

// Instant client-side redirect for signed-out visitors so the dashboard
// shell (sidebar/topbar) never flashes before the per-page `auth.protect()`
// server-side check redirects. See src/proxy.ts for why protection lives
// here and in each page rather than in Middleware.
export function SignedOutRedirect({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">{children}</Show>
      <Show when="signed-out">
        <RedirectToSignIn />
      </Show>
    </>
  );
}
