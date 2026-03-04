import { mongodb } from "../../../lib/db/mongodb";

export interface EventMetadata {
  organizationId: string;
  projectId: string;
  requestId: string;
  method: string;
  route: string;
  url: string;
  statusCode: number;
  timestamp: Date;
  durationMs: number;
  isError: boolean;
  errorHash?: string;
  errorMessage?: string;
  environment: string;
  userId?: string;
  gitCommitSha?: string;
  correlationId: string;
  s3Pointer: string;
  operations: {
    dbQueries: number;
    externalCalls: number;
    redisOps: number;
  };
}

export async function storeEventMetadata(event: EventMetadata): Promise<void> {
  const db = await mongodb.getDb();
  const collection = db.collection("events");

  await collection.insertOne({
    ...event,
    createdAt: new Date(),
  });
}
