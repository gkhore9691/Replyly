import { Command } from "commander";
import WebSocket from "ws";
import chalk from "chalk";
import ora from "ora";
import { AuthManager } from "../auth/auth-manager";
import { ApiClient } from "../api/client";

function getWsUrl(): string {
  const base = process.env.REPLAYLY_WS_URL || process.env.WS_URL;
  if (base) return base;
  const apiUrl = process.env.REPLAYLY_API_URL || process.env.API_URL || "https://api.replayly.dev";
  if (apiUrl.startsWith("https://")) {
    return apiUrl.replace("https://", "wss://").replace(/\/$/, "") + ":3001";
  }
  if (apiUrl.startsWith("http://")) {
    return apiUrl.replace("http://", "ws://").replace(/\/$/, "").replace(/:\d+$/, "") + ":3001";
  }
  return "ws://localhost:3001";
}

export function createTailCommand(): Command {
  return new Command("tail")
    .description("Stream live events from a project")
    .option("-p, --project <id>", "Project ID")
    .option("-r, --route <pattern>", "Filter by route pattern")
    .option("-s, --status <codes>", "Filter by status codes (comma-separated)")
    .option("--errors-only", "Show only errors (4xx, 5xx)")
    .action(async (options: { project?: string; route?: string; status?: string; errorsOnly?: boolean }) => {
      const authManager = new AuthManager();

      if (!authManager.isAuthenticated()) {
        console.error(chalk.red("Not logged in. Run `replayly login` first."));
        process.exit(1);
      }

      const token = authManager.getToken();
      if (!token) {
        console.error(chalk.red("Not logged in. Run `replayly login` first."));
        process.exit(1);
      }

      let projectId = options.project;
      if (!projectId) {
        const apiClient = new ApiClient(token);
        const projects = await apiClient.getProjects();
        if (projects.length === 0) {
          console.error(chalk.red("No projects found"));
          process.exit(1);
        }
        projectId = projects[0].id;
        console.log(chalk.blue(`Using project: ${projects[0].name}`));
      }

      const spinner = ora("Connecting to event stream...").start();

      const filters: { routes?: string[]; statusCodes?: number[]; errorOnly?: boolean } = {};
      if (options.route) filters.routes = [options.route];
      if (options.status) {
        filters.statusCodes = options.status.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
      }
      if (options.errorsOnly) filters.errorOnly = true;

      const wsUrl = getWsUrl();
      const url = `${wsUrl}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);

      ws.on("open", () => {
        spinner.succeed("Connected to event stream");
        console.log(chalk.gray("Waiting for events...\n"));
        ws.send(
          JSON.stringify({
            type: "subscribe",
            payload: { projectId, filters },
          })
        );
      });

      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as { type: string; payload?: { data?: Record<string, unknown> } };
          if (message.type === "event" && message.payload?.data) {
            const event = message.payload.data as Record<string, unknown>;
            const timestamp = new Date((event.timestamp as string) || Date.now()).toLocaleTimeString();
            const method = String(event.method ?? "").padEnd(6);
            const route = String(event.route ?? "");
            const status = event.statusCode as number;
            const durationMs = event.durationMs as number;
            const duration = typeof durationMs === "number" ? `${durationMs}ms` : "—";

            let statusColor = chalk.green;
            if (status >= 500) statusColor = chalk.red;
            else if (status >= 400) statusColor = chalk.yellow;
            else if (status >= 300) statusColor = chalk.cyan;

            console.log(chalk.gray(timestamp), chalk.blue(method), route, statusColor(String(status)), chalk.gray(duration));

            const err = event.error as { message?: string } | undefined;
            if (err?.message) {
              console.log(chalk.red(`  └─ ${err.message}`));
            }
          }
        } catch {
          // ignore parse errors
        }
      });

      ws.on("error", (error: Error) => {
        spinner.fail("Connection error");
        console.error(chalk.red(error.message));
        process.exit(1);
      });

      ws.on("close", () => {
        console.log(chalk.yellow("\nConnection closed"));
        process.exit(0);
      });

      process.on("SIGINT", () => {
        console.log(chalk.yellow("\nClosing connection..."));
        ws.close();
      });
    });
}
