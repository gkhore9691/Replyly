import { Command } from "commander";
import { ReplayEngine, ReplayResult } from "../replay/engine";
import { AuthManager } from "../auth/auth-manager";
import { ApiClient } from "../api/client";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import { trackReplay } from "../replay/history";

interface ReplayOptions {
  eventId?: string;
  port?: string;
  host?: string;
  https?: boolean;
  dryRun?: boolean;
}

interface EventForReplay {
  requestId: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  timestamp?: string;
  fullPayload?: Record<string, unknown>;
  operations?: { dbQueries: number; externalCalls: number; redisOps: number };
}

async function promptForEvent(): Promise<string> {
  const authManager = new AuthManager();
  const apiClient = new ApiClient(authManager.getToken()!);

  const spinner = ora("Fetching recent events...").start();
  const events = await apiClient.getRecentEvents();
  spinner.stop();

  if (events.length === 0) {
    throw new Error("No events found. Capture some requests first.");
  }

  const { eventId } = await inquirer.prompt<{ eventId: string }>([
    {
      type: "list",
      name: "eventId",
      message: "Select an event to replay:",
      choices: events.map((event: { requestId: string; method: string; route: string; statusCode: number; timestamp: string }) => ({
        name: `${event.method} ${event.route ?? "—"} - ${event.statusCode} (${new Date(event.timestamp).toLocaleString()})`,
        value: event.requestId,
      })),
    },
  ]);

  return eventId;
}

function displayReplayResult(
  result: ReplayResult,
  originalEvent: EventForReplay
): void {
  console.log();
  console.log(chalk.bold("Replay Results:"));
  console.log();

  const origStatus = originalEvent.statusCode ?? 0;
  const origDuration = originalEvent.durationMs ?? 0;

  console.log(chalk.bold("Response:"));
  console.log(
    `  Status: ${chalk.yellow(result.statusCode)} ${result.statusCode === origStatus ? chalk.green("✓") : chalk.red("✗ (original: " + origStatus + ")")}`
  );
  console.log(
    `  Duration: ${result.durationMs}ms ${chalk.gray(`(original: ${origDuration}ms)`)}`
  );
  console.log();

  if (result.operations && originalEvent.operations) {
    console.log(chalk.bold("Operations:"));
    console.log(
      `  DB Queries: ${result.operations.dbQueries} ${chalk.gray(`(original: ${originalEvent.operations.dbQueries})`)}`
    );
    console.log(
      `  External Calls: ${result.operations.externalCalls} ${chalk.gray(`(original: ${originalEvent.operations.externalCalls})`)}`
    );
    console.log(
      `  Redis Ops: ${result.operations.redisOps} ${chalk.gray(`(original: ${originalEvent.operations.redisOps})`)}`
    );
    console.log();
  }

  if (result.trace && result.trace.length > 0) {
    console.log(chalk.bold("Lifecycle Trace:"));
    result.trace.forEach((step: { timestamp: string; event: string }) => {
      console.log(`  ${chalk.gray(step.timestamp)} ${step.event}`);
    });
    console.log();
  }

  if (result.differences && result.differences.length > 0) {
    console.log(chalk.yellow.bold("⚠ Differences Detected:"));
    result.differences.forEach((diff: string) => {
      console.log(`  ${chalk.yellow("•")} ${diff}`);
    });
    console.log();
  }
}

export function createReplayCommand(): Command {
  return new Command("replay")
    .description("Replay a captured event locally")
    .option("-e, --event-id <id>", "Event ID to replay")
    .option("-p, --port <port>", "Local server port", "3000")
    .option("--host <host>", "Local server host", "localhost")
    .option("--https", "Use HTTPS", false)
    .option("--dry-run", "Show request without executing", false)
    .action(async (options: ReplayOptions) => {
      const authManager = new AuthManager();

      if (!authManager.isAuthenticated()) {
        console.error(chalk.red("Not authenticated. Run: replayly login"));
        process.exit(1);
      }

      let eventId = options.eventId;

      if (!eventId) {
        eventId = await promptForEvent();
      }

      const spinner = ora("Fetching event data...").start();

      try {
        const token = authManager.getToken()!;
        const apiClient = new ApiClient(token);
        const event = (await apiClient.getEvent(eventId!)) as EventForReplay;

        spinner.succeed("Event data fetched");

        console.log();
        console.log(chalk.bold("Event Details:"));
        console.log(`  Method: ${chalk.cyan(event.method ?? "—")}`);
        console.log(`  Route: ${chalk.cyan(event.route ?? "—")}`);
        console.log(`  Status: ${chalk.yellow(event.statusCode ?? "—")}`);
        console.log(`  Duration: ${event.durationMs ?? 0}ms`);
        console.log(
          `  Timestamp: ${event.timestamp ? new Date(event.timestamp).toLocaleString() : "—"}`
        );
        console.log();

        if (options.dryRun) {
          console.log(chalk.bold("Request Preview:"));
          console.log(
            JSON.stringify(event.fullPayload ?? {}, null, 2)
          );
          return;
        }

        const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
          {
            type: "confirm",
            name: "confirm",
            message: `Replay this request to ${options.host}:${options.port}?`,
            default: true,
          },
        ]);

        if (!confirm) {
          console.log(chalk.yellow("Replay cancelled"));
          return;
        }

        const engine = new ReplayEngine({
          host: options.host ?? "localhost",
          port: parseInt(options.port ?? "3000", 10),
          https: options.https ?? false,
        });

        spinner.start("Replaying request...");

        const result = await engine.replay(event);

        spinner.succeed("Replay completed");

        displayReplayResult(result, event);

        // Best-effort tracking of replay history
        await trackReplay(
          {
            eventId: event.requestId,
            mode: "hybrid",
            success: true,
            duration: result.durationMs,
            differences: result.differences,
          },
          token
        );
      } catch (error: unknown) {
        const err = error as Error;
        spinner.fail(chalk.red(`Replay failed: ${err.message}`));
        console.error(err);
        process.exit(1);
      }
    });
}
