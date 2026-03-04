import { config } from "dotenv";
import path from "path";

const root = path.resolve(process.cwd());
config({ path: path.join(root, ".env") });
config({ path: path.join(root, ".env.local") });
