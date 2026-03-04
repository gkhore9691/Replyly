import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { gunzip } from "zlib";
import { promisify } from "util";

const gunzipAsync = promisify(gunzip);

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

const BUCKET = process.env.S3_BUCKET || "replayly-events";

async function streamToBuffer(stream: unknown): Promise<Buffer> {
  if (!stream) throw new Error("Empty response body");
  const chunks: Buffer[] = [];
  const s = stream as AsyncIterable<Uint8Array> & { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof s.transformToByteArray === "function") {
    const bytes = await s.transformToByteArray();
    return Buffer.from(bytes);
  }
  for await (const chunk of s) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function getEventPayload(s3Pointer: string): Promise<unknown> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Pointer,
    })
  );

  const compressed = await streamToBuffer(response.Body);
  const decompressed = await gunzipAsync(compressed);
  return JSON.parse(decompressed.toString("utf-8")) as unknown;
}
