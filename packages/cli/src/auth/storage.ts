import os from "os";
import path from "path";
import fs from "fs";

const CONFIG_DIR = path.join(os.homedir(), ".replayly");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

export class CredentialStorage {
  constructor() {
    this.ensureConfigDir();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
  }

  save(key: string, value: unknown): void {
    const data = this.loadAll();
    data[key] = value;

    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(data, null, 2),
      { mode: 0o600 }
    );
  }

  get(key: string): unknown {
    const data = this.loadAll();
    return data[key];
  }

  delete(key: string): void {
    const data = this.loadAll();
    delete data[key];

    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(data, null, 2),
      { mode: 0o600 }
    );
  }

  private loadAll(): Record<string, unknown> {
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return {};
    }

    const content = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  }
}
