import { gzip } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);

export async function compressPayload(data: unknown): Promise<Buffer> {
  const json = JSON.stringify(data);
  return gzipAsync(Buffer.from(json, "utf-8"));
}
