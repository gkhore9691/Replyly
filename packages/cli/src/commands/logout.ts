import { Command } from "commander";
import { AuthManager } from "../auth/auth-manager";
import chalk from "chalk";

export function createLogoutCommand(): Command {
  return new Command("logout")
    .description("Clear stored credentials")
    .action(async () => {
      const authManager = new AuthManager();
      await authManager.logout();
      console.log(chalk.green("Logged out successfully"));
    });
}
