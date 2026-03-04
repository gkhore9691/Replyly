import type { ReplaylyClient } from "../../core/client";

export function instrument(client: ReplaylyClient): void {
  try {
    const Redis = require("ioredis");
    const originalSendCommand = Redis.prototype.sendCommand;

    Redis.prototype.sendCommand = function (command: { name: string }, ...args: unknown[]) {
      const startTime = Date.now();
      const commandName = command.name;

      const promise = originalSendCommand.call(this, command, ...args);

      promise
        .then(() => {
          client.captureOperation("redis_op", {
            command: commandName,
            durationMs: Date.now() - startTime,
            success: true,
          });
        })
        .catch((error: Error) => {
          client.captureOperation("redis_op", {
            command: commandName,
            durationMs: Date.now() - startTime,
            success: false,
            error: error.message,
          });
        });

      return promise;
    };
  } catch {
    // ioredis not installed
  }
}
