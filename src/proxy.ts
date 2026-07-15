import { clerkMiddleware } from "@clerk/nextjs/server";

// NOTE: Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (same runtime behavior, just a new file name/export). See:
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//
// This only refreshes the Clerk session for every request; it does NOT gate
// access. Clerk now recommends resource-based auth (`await auth.protect()`
// in each protected page/layout/Server Function) over path-matching in
// Middleware, since Server Functions are invoked by ID and can't reliably be
// covered by a path matcher. See src/app/dashboard/layout.tsx.
export const proxy = clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
