import { Command } from "commander";
import { AuthManager } from "../auth/auth-manager";
import { ApiClient } from "../api/client";
import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";

export function createEventsCommand(): Command {
  return new Command("events")
    .description("List captured events")
    .option("-p, --project <id>", "Project ID")
    .option("-l, --limit <number>", "Number of events to show", "20")
    .option("--errors-only", "Show only errors", false)
    .option("--route <route>", "Filter by route")
    .action(async (options: {
      project?: string;
      limit?: string;
      errorsOnly?: boolean;
      route?: string;
    }) => {
      const authManager = new AuthManager();

      if (!authManager.isAuthenticated()) {
        console.error(chalk.red("Not authenticated. Run: replayly login"));
        process.exit(1);
      }

      const spinner = ora("Fetching events...").start();

      try {
        const apiClient = new ApiClient(authManager.getToken()!);

        const events = await apiClient.getEvents({
          projectId: options.project,
          limit: parseInt(options.limit ?? "20", 10),
          isError: options.errorsOnly ? true : undefined,
          route: options.route,
        });

        spinner.stop();

        if (events.length === 0) {
          console.log(chalk.yellow("No events found"));
          return;
        }

        const table = new Table({
          head: ["ID", "Method", "Route", "Status", "Duration", "Time"],
          colWidths: [15, 8, 30, 8, 10, 20],
        });

        events.forEach((event: { requestId: string; method: string; route: string; statusCode: number; isError?: boolean; durationMs: number; timestamp: string }) => {
          table.push([
            event.requestId.substring(0, 12) + "...",
            event.method,
            event.route ?? "—",
            event.isError ? chalk.red(String(event.statusCode)) : chalk.green(String(event.statusCode)),
            `${event.durationMs}ms`,
            new Date(event.timestamp).toLocaleTimeString(),
          ]);
        });

        console.log(table.toString());
        console.log();
        console.log(chalk.gray(`Showing ${events.length} events`));
      } catch (error: unknown) {
        const err = error as Error;
        spinner.fail(chalk.red(`Failed to fetch events: ${err.message}`));
        process.exit(1);
      }
    });
}
