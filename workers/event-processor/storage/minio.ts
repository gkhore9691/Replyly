import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

const accessKey = process.env.S3_ACCESS_KEY?.trim() ?? "";
const secretKey = process.env.S3_SECRET_KEY?.trim() ?? "";
const hasS3Credentials = accessKey.length > 0 && secretKey.length > 0;

const s3Client = hasS3Credentials
  ? new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION || "us-east-1",
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true,
    })
  : null;

const BUCKET = process.env.S3_BUCKET || "replayly-events";
let bucketEnsured = false;

async function ensureBucket(): Promise<void> {
  if (!s3Client || bucketEnsured) return;
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  bucketEnsured = true;
}

export async function storeEventPayload(
  organizationId: string,
  projectId: string,
  requestId: string,
  payload: Buffer
): Promise<string> {
  if (!s3Client) {
    return "";
  }
  await ensureBucket();
  const key = `${organizationId}/${projectId}/${requestId}.json.gz`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: payload,
      ContentType: "application/json",
      ContentEncoding: "gzip",
    })
  );

  return key;
}
