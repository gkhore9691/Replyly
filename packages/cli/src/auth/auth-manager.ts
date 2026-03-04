import { CredentialStorage } from "./storage";

interface Token {
  accessToken: string;
  expiresAt: number;
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

function getApiUrl(): string {
  return process.env.REPLAYLY_API_URL || process.env.API_URL || "https://api.replayly.dev";
}

export class AuthManager {
  private storage: CredentialStorage;

  constructor() {
    this.storage = new CredentialStorage();
  }

  async saveToken(token: Token): Promise<void> {
    await this.storage.save("token", token);
  }

  getToken(): string | null {
    const token = this.storage.get("token") as Token | undefined;

    if (!token) return null;

    if (Date.now() > token.expiresAt) {
      this.storage.delete("token");
      return null;
    }

    return token.accessToken;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  async getCurrentUser(): Promise<User> {
    const token = this.getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }

    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user");
    }

    const data = (await response.json()) as { user: User };
    return data.user;
  }

  async logout(): Promise<void> {
    this.storage.delete("token");
  }
}
