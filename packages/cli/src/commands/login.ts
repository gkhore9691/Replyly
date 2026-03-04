import { Command } from "commander";
import { AuthManager } from "../auth/auth-manager";
import { deviceFlow } from "../auth/device-flow";
import chalk from "chalk";
import ora from "ora";

export function createLoginCommand(): Command {
  return new Command("login")
    .description("Authenticate with Replayly")
    .action(async () => {
      const spinner = ora("Starting authentication...").start();

      try {
        const { verificationUri, userCode, deviceCode } =
          await deviceFlow.initiate();

        spinner.stop();

        console.log();
        console.log(chalk.bold("To authenticate, visit:"));
        console.log(chalk.cyan.underline(verificationUri));
        console.log();
        console.log(chalk.bold("And enter code:"));
        console.log(chalk.yellow.bold(userCode));
        console.log();

        spinner.start("Waiting for authentication...");

        const token = await deviceFlow.poll(deviceCode);

        const authManager = new AuthManager();
        await authManager.saveToken(token);

        const user = await authManager.getCurrentUser();

        spinner.succeed(
          chalk.green(`Successfully authenticated as ${user.email}`)
        );
      } catch (error: unknown) {
        const err = error as Error;
        spinner.fail(chalk.red(`Authentication failed: ${err.message}`));
        process.exit(1);
      }
    });
}
