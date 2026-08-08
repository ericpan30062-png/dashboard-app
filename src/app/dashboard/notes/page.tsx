import { auth } from "@clerk/nextjs/server";
import { getOrCreateUser } from "@/lib/clerk-sync";
import { getNotionCredentials, listNotes } from "@/lib/notion";
import { NotionConnection } from "@/components/dashboard/notion-connection";
import { NotesView } from "@/components/dashboard/notes-view";

export default async function NotesPage() {
  await auth.protect();
  const user = await getOrCreateUser();
  const integration = user?.integrations.find((i) => i.provider === "NOTION");
  const connected = Boolean(integration?.connectedAt);

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Notes
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Connect Notion to keep notes here in sync with a database in your
            own Notion workspace.
          </p>
        </div>
        <NotionConnection connected={false} />
      </div>
    );
  }

  const creds = user ? await getNotionCredentials(user.id) : null;
  let notes: Awaited<ReturnType<typeof listNotes>> = [];
  let loadError: string | null = null;
  if (creds) {
    try {
      notes = await listNotes(creds);
    } catch (error) {
      console.error("Notes page: listNotes failed:", error);
      loadError = "Couldn't load your notes from Notion — try refreshing.";
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Notes
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Synced with your connected Notion database.
        </p>
      </div>

      <NotionConnection connected />

      {loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {loadError}
        </p>
      ) : (
        <NotesView initialNotes={notes} />
      )}
    </div>
  );
}
