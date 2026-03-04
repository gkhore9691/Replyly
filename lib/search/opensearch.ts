import { Client } from "@opensearch-project/opensearch";

const client = new Client({
  node: process.env.OPENSEARCH_URL || "http://localhost:9200",
});

export function getOpenSearchClient(): Client {
  return client;
}

interface SearchHit {
  _source: Record<string, unknown>;
}

interface SearchResponse {
  body?: {
    hits?: {
      hits?: SearchHit[];
    };
  };
}

export async function searchEvents(
  projectId: string,
  query: string
): Promise<Record<string, unknown>[]> {
  const index = `events-${projectId}`;

  try {
    const response = (await client.search({
      index,
      body: {
        query: {
          multi_match: {
            query,
            fields: ["url", "route", "errorMessage"],
            fuzziness: "AUTO",
          },
        },
        size: 50,
        sort: [{ timestamp: "desc" }],
      },
    })) as SearchResponse;

    const hits = response?.body?.hits?.hits ?? [];
    return hits.map((hit) => hit._source ?? {});
  } catch {
    return [];
  }
}
