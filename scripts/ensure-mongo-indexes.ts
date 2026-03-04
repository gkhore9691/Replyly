/**
 * Ensure MongoDB indexes exist for the events collection (performance).
 * Run once after deployment or when adding new query patterns.
 * Usage: npx tsx scripts/ensure-mongo-indexes.ts
 */
import { config } from "dotenv";
import path from "path";
import { MongoClient } from "mongodb";

const root = path.resolve(process.cwd());
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local") });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set");
  process.exit(1);
}

const INDEXES: { keys: Record<string, 1 | -1>; options?: { expireAfterSeconds?: number } }[] = [
  { keys: { projectId: 1, timestamp: -1 } },
  { keys: { projectId: 1, errorHash: 1 } },
  { keys: { projectId: 1, route: 1, timestamp: -1 } },
  { keys: { projectId: 1, statusCode: 1 } },
  { keys: { correlationId: 1 } },
  { keys: { organizationId: 1 } },
  { keys: { projectId: 1, gitCommitSha: 1 } },
  // Optional TTL: uncomment to auto-delete events after 30 days
  // { keys: { timestamp: 1 }, options: { expireAfterSeconds: 2592000 } },
];

async function main() {
  const client = new MongoClient(uri as string);
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection("events");

    for (const { keys, options } of INDEXES) {
      const name = Object.entries(keys)
        .map(([k, v]) => `${k}_${v}`)
        .join("_");
      try {
        await collection.createIndex(keys, { name, ...options });
        console.log("Created index:", name);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 85) {
          console.log("Index already exists:", name);
        } else {
          throw err;
        }
      }
    }

    console.log("MongoDB indexes ensured.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
