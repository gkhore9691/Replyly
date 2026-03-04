/**
 * Load .env and .env.local before any other server code runs.
 * Must be the first import in ws-server.ts so JWT_SECRET etc. are set
 * before lib/auth/jwt is loaded.
 */
import { config } from "dotenv";
import path from "path";

const root = path.resolve(process.cwd());
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local") });
