export interface JiraConfig {
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: JiraConfig) {
    this.baseUrl = `https://${config.domain}/rest/api/3`;
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${config.apiToken}`).toString("base64")}`;
  }

  async createIssue(data: {
    summary: string;
    description: string;
    issueType: string;
    projectKey: string;
    labels?: string[];
  }) {
    const res = await fetch(`${this.baseUrl}/issue`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: { key: data.projectKey },
          summary: data.summary,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: data.description,
                  },
                ],
              },
            ],
          },
          issuetype: { name: data.issueType },
          labels: data.labels ?? [],
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Jira API error ${res.status}: ${errBody}`);
    }

    return (await res.json()) as { key: string; id: string };
  }

  async getIssue(issueKey: string) {
    const res = await fetch(`${this.baseUrl}/issue/${issueKey}`, {
      headers: { Authorization: this.authHeader },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Jira API error ${res.status}: ${errBody}`);
    }

    return (await res.json()) as { key: string; id: string };
  }

  async updateIssueStatus(issueKey: string, transitionId: string) {
    const res = await fetch(`${this.baseUrl}/issue/${issueKey}/transitions`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transition: { id: transitionId },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Jira API error ${res.status}: ${errBody}`);
    }
  }
}
