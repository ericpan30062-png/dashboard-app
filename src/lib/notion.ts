import { prisma } from "@/lib/prisma";

export type NotionCredentials = {
  token: string;
  databaseId: string;
  titleProperty: string;
};

const NOTION_VERSION = "2022-06-28";
const BODY_PROPERTY = "Body";

async function notionFetch(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

// Notion credentials are per-user (a personal "internal integration" token
// the user creates in their own Notion workspace, plus the ID of a database
// they've shared with it) — stored on Integration like Canvas's token.
// titleProperty is cached from verifyAndPrepareNotionDatabase since every
// Notion database's title-type property has a user-chosen name (often
// "Name") rather than a fixed key.
export async function getNotionCredentials(
  userId: string,
): Promise<NotionCredentials | null> {
  const integration = await prisma.integration.findUnique({
    where: { userId_provider: { userId, provider: "NOTION" } },
  });
  if (!integration?.accessToken) return null;

  const metadata = integration.metadata as
    | { databaseId?: string; titleProperty?: string }
    | null;
  if (!metadata?.databaseId || !metadata?.titleProperty) return null;

  return {
    token: integration.accessToken,
    databaseId: metadata.databaseId,
    titleProperty: metadata.titleProperty,
  };
}

type NotionDatabase = {
  properties: Record<string, { type: string }>;
};

// Confirms the token can actually read the given database, finds its
// title-type property's name, and — since notes need somewhere to put the
// body text — adds a "Body" rich-text property to the database if one
// doesn't already exist. Returns null (rather than throwing) on any
// failure, mirroring verifyCanvasCredentials.
export async function verifyAndPrepareNotionDatabase(
  token: string,
  databaseId: string,
): Promise<{ titleProperty: string } | null> {
  try {
    const res = await notionFetch(token, `/databases/${databaseId}`);
    if (!res.ok) return null;

    const database = (await res.json()) as NotionDatabase;
    const titleEntry = Object.entries(database.properties).find(
      ([, prop]) => prop.type === "title",
    );
    if (!titleEntry) return null;
    const titleProperty = titleEntry[0];

    const hasBodyProperty = database.properties[BODY_PROPERTY]?.type === "rich_text";
    if (!hasBodyProperty) {
      const patchRes = await notionFetch(token, `/databases/${databaseId}`, {
        method: "PATCH",
        body: JSON.stringify({
          properties: { [BODY_PROPERTY]: { rich_text: {} } },
        }),
      });
      if (!patchRes.ok) return null;
    }

    return { titleProperty };
  } catch {
    return null;
  }
}

export type Note = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

type NotionPage = {
  id: string;
  archived?: boolean;
  last_edited_time: string;
  properties: Record<
    string,
    { type: string; title?: { plain_text: string }[]; rich_text?: { plain_text: string }[] }
  >;
};

function parsePage(page: NotionPage, titleProperty: string): Note {
  const title =
    page.properties[titleProperty]?.title?.map((t) => t.plain_text).join("") ?? "";
  const body =
    page.properties[BODY_PROPERTY]?.rich_text?.map((t) => t.plain_text).join("") ?? "";
  return { id: page.id, title, body, updatedAt: page.last_edited_time };
}

function buildProperties(titleProperty: string, title: string, body: string) {
  return {
    [titleProperty]: { title: [{ text: { content: title } }] },
    [BODY_PROPERTY]: { rich_text: [{ text: { content: body } }] },
  };
}

export async function listNotes(creds: NotionCredentials): Promise<Note[]> {
  const res = await notionFetch(creds.token, `/databases/${creds.databaseId}/query`, {
    method: "POST",
    body: JSON.stringify({
      page_size: 100,
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion list notes failed: ${res.status}`);
  }

  const body = (await res.json()) as { results: NotionPage[] };
  return body.results
    .filter((page) => !page.archived)
    .map((page) => parsePage(page, creds.titleProperty));
}

export async function createNote(
  creds: NotionCredentials,
  input: { title: string; body: string },
): Promise<Note> {
  const res = await notionFetch(creds.token, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { database_id: creds.databaseId },
      properties: buildProperties(creds.titleProperty, input.title, input.body),
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion create note failed: ${res.status}`);
  }

  const page = (await res.json()) as NotionPage;
  return parsePage(page, creds.titleProperty);
}

export async function updateNote(
  creds: NotionCredentials,
  pageId: string,
  input: { title: string; body: string },
): Promise<Note> {
  const res = await notionFetch(creds.token, `/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({
      properties: buildProperties(creds.titleProperty, input.title, input.body),
    }),
  });
  if (!res.ok) {
    throw new Error(`Notion update note failed: ${res.status}`);
  }

  const page = (await res.json()) as NotionPage;
  return parsePage(page, creds.titleProperty);
}

export async function archiveNote(
  creds: NotionCredentials,
  pageId: string,
): Promise<void> {
  const res = await notionFetch(creds.token, `/pages/${pageId}`, {
    method: "PATCH",
    body: JSON.stringify({ archived: true }),
  });
  if (!res.ok) {
    throw new Error(`Notion archive note failed: ${res.status}`);
  }
}
