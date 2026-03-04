import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI ?? "";
let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) {
    return db;
  }
  if (!uri) {
    throw new Error("MONGODB_URI is not set");
  }
  if (process.env.NODE_ENV === "development") {
    const safeUri = uri.replace(/:[^:@]+@/, ":****@");
    console.warn("[mongodb] connecting:", safeUri);
  }
  client = new MongoClient(uri);
  await client.connect();
  db = client.db();
  return db;
}

export async function getDb(): Promise<Db> {
  if (!db) {
    return connectMongo();
  }
  return db;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export const mongodb = {
  getDb,
  connect: connectMongo,
  close: closeMongo,
};
