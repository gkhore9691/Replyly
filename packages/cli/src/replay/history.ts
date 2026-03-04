import axios from "axios";

function getApiUrl(): string {
  return process.env.REPLAYLY_API_URL || process.env.API_URL || "https://api.replayly.dev";
}

export interface TrackedReplayResult {
  eventId: string;
  mode: string;
  success: boolean;
  duration: number;
  differences?: unknown;
  error?: string;
}

export async function trackReplay(
  result: TrackedReplayResult,
  token: string
): Promise<void> {
  try {
    const baseUrl = getApiUrl();
    await axios.post(`${baseUrl}/api/replays`, result, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // tracking failures should not break replay
  }
}

