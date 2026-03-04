/**
 * Load .env and .env.local from project root before any other worker code runs.
 * Must be imported first so process.env is set before libs (mongodb, minio, etc.) are loaded.
 */
import { config } from "dotenv";
import path from "path";

const root = path.resolve(process.cwd());
const r1 = config({ path: path.join(root, ".env"), debug: false });
const r2 = config({ path: path.join(root, ".env.local"), debug: false });

const required = [
  "MONGODB_URI",
  "REDIS_URL",
  "DATABASE_URL",
  "S3_ENDPOINT",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",
  "OPENSEARCH_URL",
] as const;

const status = required.map((key) => {
  const val = process.env[key];
  const set = val !== undefined && val.trim() !== "";
  return { key, set: set ? "✓" : "✗", value: set ? "(set)" : "(missing)" };
});

console.log("[Worker env] loaded:", {
  ".env": r1.parsed ? Object.keys(r1.parsed).length + " vars" : "not found",
  ".env.local": r2.parsed ? Object.keys(r2.parsed).length + " vars" : "not found",
});
console.log("[Worker env] required:", status.map((s) => `${s.key}=${s.value}`).join(" "));
