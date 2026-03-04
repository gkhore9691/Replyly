/**
 * Clear all events from MongoDB so you can send fresh events.
 * Loads .env / .env.local from project root.
 * Usage: npm run db:clear-events   or   tsx scripts/clear-events.ts
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

async function main() {
  const client = new MongoClient(uri as string);
  try {
    await client.connect();
    const db = client.db();
    const result = await db.collection("events").deleteMany({});
    console.log(`Deleted ${result.deletedCount} events from MongoDB.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
