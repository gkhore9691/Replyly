import { Client } from "@opensearch-project/opensearch";

const client = new Client({
  node: process.env.OPENSEARCH_URL || "http://localhost:9200",
});

export interface SearchDocument {
  organizationId: string;
  projectId: string;
  requestId: string;
  method: string;
  url: string;
  route: string;
  statusCode: number;
  timestamp: string;
  errorMessage?: string;
  errorHash?: string;
  environment: string;
  s3Pointer: string;
}

const indexMappings = {
  mappings: {
    properties: {
      organizationId: { type: "keyword" as const },
      projectId: { type: "keyword" as const },
      requestId: { type: "keyword" as const },
      method: { type: "keyword" as const },
      url: { type: "text" as const },
      route: { type: "keyword" as const },
      statusCode: { type: "integer" as const },
      timestamp: { type: "date" as const },
      errorMessage: { type: "text" as const },
      errorHash: { type: "keyword" as const },
      environment: { type: "keyword" as const },
      s3Pointer: { type: "keyword" as const },
    },
  },
};

async function ensureIndexExists(index: string): Promise<void> {
  try {
    const exists = await client.indices.exists({ index });
    const existsBody = (exists as { body?: boolean }).body;
    if (existsBody) return;
  } catch {
    // ignore
  }
  try {
    await client.indices.create({ index, body: indexMappings });
  } catch (err: unknown) {
    const e = err as { meta?: { body?: { error?: { type?: string } } } };
    if (e?.meta?.body?.error?.type !== "resource_already_exists_exception") {
      throw err;
    }
  }
}

export async function indexEventSearch(doc: SearchDocument): Promise<void> {
  const index = `events-${doc.projectId}`;
  await ensureIndexExists(index);

  await client.index({
    index,
    id: doc.requestId,
    body: doc,
  });
}
