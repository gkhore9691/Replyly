import axios from "axios";

function getApiUrl(): string {
  return process.env.REPLAYLY_API_URL || process.env.API_URL || "https://api.replayly.dev";
}

const POLL_INTERVAL = 5000;
const TIMEOUT = 300000;

interface DeviceFlowInitiation {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
}

class DeviceFlow {
  async initiate(): Promise<DeviceFlowInitiation> {
    const baseUrl = getApiUrl();
    const response = await axios.post<DeviceFlowInitiation>(
      `${baseUrl}/api/auth/device/code`
    );
    return response.data;
  }

  async poll(
    deviceCode: string
  ): Promise<{ accessToken: string; expiresAt: number }> {
    const baseUrl = getApiUrl();
    const startTime = Date.now();

    while (Date.now() - startTime < TIMEOUT) {
      try {
        const response = await axios.post<{
          accessToken?: string;
          expiresIn?: number;
        }>(`${baseUrl}/api/auth/device/token`, {
          deviceCode,
        });

        if (response.data.accessToken && response.data.expiresIn) {
          return {
            accessToken: response.data.accessToken,
            expiresAt: Date.now() + response.data.expiresIn * 1000,
          };
        }
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 428) {
          await this.sleep(POLL_INTERVAL);
          continue;
        }
        throw error;
      }

      await this.sleep(POLL_INTERVAL);
    }

    throw new Error("Authentication timeout");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const deviceFlow = new DeviceFlow();
