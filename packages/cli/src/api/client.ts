import axios, { AxiosInstance } from "axios";

function getApiUrl(): string {
  return process.env.REPLAYLY_API_URL || process.env.API_URL || "https://api.replayly.dev";
}

interface Project {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  environment: string;
  createdAt: string;
}

interface EventSummary {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
  isError?: boolean;
}

interface EventDetail extends EventSummary {
  fullPayload: Record<string, unknown>;
  operations?: { dbQueries: number; externalCalls: number; redisOps: number };
}

export class ApiClient {
  private client: AxiosInstance;

  constructor(token: string) {
    this.client = axios.create({
      baseURL: getApiUrl(),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getEvent(eventId: string): Promise<EventDetail> {
    const projects = await this.getProjects();

    if (projects.length === 0) {
      throw new Error("No projects found");
    }

    for (const project of projects) {
      try {
        const response = await this.client.get<EventDetail>(
          `/api/projects/${project.id}/events/${eventId}`
        );
        return response.data;
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        if (err.response?.status === 404) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("Event not found");
  }

  async getEvents(options: {
    projectId?: string;
    limit?: number;
    isError?: boolean;
    route?: string;
  }): Promise<EventSummary[]> {
    const projectId =
      options.projectId || (await this.getDefaultProject()).id;

    const response = await this.client.get<{ events: EventSummary[] }>(
      `/api/projects/${projectId}/events`,
      {
        params: {
          limit: options.limit ?? 20,
          isError: options.isError,
          route: options.route,
        },
      }
    );

    return response.data.events;
  }

  async getRecentEvents(): Promise<EventSummary[]> {
    return this.getEvents({ limit: 20 });
  }

  async getProjects(): Promise<Project[]> {
    const response = await this.client.get<{ projects: Project[] }>(
      "/api/projects"
    );
    return response.data.projects;
  }

  async getDefaultProject(): Promise<Project> {
    const projects = await this.getProjects();

    if (projects.length === 0) {
      throw new Error("No projects found");
    }

    return projects[0];
  }
}
