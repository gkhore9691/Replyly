import { Command } from "commander";
import { AuthManager } from "../auth/auth-manager";
import { ApiClient } from "../api/client";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";

export function createProjectsCommand(): Command {
  return new Command("projects")
    .description("List your Replayly projects")
    .action(async () => {
      const authManager = new AuthManager();

      if (!authManager.isAuthenticated()) {
        console.error(chalk.red("Not authenticated. Run: replayly login"));
        process.exit(1);
      }

      const spinner = ora("Fetching projects...").start();

      try {
        const apiClient = new ApiClient(authManager.getToken()!);
        const projects = await apiClient.getProjects();

        spinner.stop();

        if (projects.length === 0) {
          console.log(chalk.yellow("No projects found"));
          return;
        }

        const table = new Table({
          head: ["ID", "Name", "Slug", "Environment"],
          colWidths: [40, 20, 20, 12],
        });

        projects.forEach((p) => {
          table.push([p.id, p.name, p.slug, p.environment ?? "—"]);
        });

        console.log(table.toString());
        console.log();
        console.log(chalk.gray(`Showing ${projects.length} project(s)`));
      } catch (error: unknown) {
        const err = error as Error;
        spinner.fail(chalk.red(`Failed to fetch projects: ${err.message}`));
        process.exit(1);
      }
    });
}
