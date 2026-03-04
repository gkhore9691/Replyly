import type { ReplaylyClient } from "../../core/client";

type PrismaParams = { model?: string; action: string; args?: unknown[] };
type PrismaNext = (params: PrismaParams) => Promise<unknown>;

/**
 * Instrument Prisma Client to record queries in the current Replayly context.
 * Uses Prisma middleware ($use). For Prisma 5+ with $use removed, consider using query logging or $extends.
 *
 * @param prisma - PrismaClient instance
 * @param client - ReplaylyClient instance
 */
export function instrumentPrisma(
  prisma: { $use?: (fn: (params: PrismaParams, next: PrismaNext) => Promise<unknown>) => void },
  client: ReplaylyClient
): typeof prisma {
  const use = prisma.$use;
  if (typeof use !== "function") {
    return prisma;
  }

  use.call(prisma, async (params: PrismaParams, next: PrismaNext) => {
    const context = client.getContext();
    if (!context) return next(params);

    const operation = {
      type: "prisma",
      model: params.model ?? "Unknown",
      action: params.action,
      startTime: Date.now(),
      durationMs: 0,
    } as Record<string, unknown>;

    if (!context.operationList) context.operationList = [];

    try {
      const result = await next(params);
      operation.durationMs = Date.now() - (operation.startTime as number);
      context.operationList.push(operation);
      return result;
    } catch (err: unknown) {
      operation.durationMs = Date.now() - (operation.startTime as number);
      operation.error = {
        message: err instanceof Error ? err.message : String(err),
        code: err && typeof err === "object" && "code" in err ? (err as { code: string }).code : undefined,
      };
      context.operationList.push(operation);
      throw err;
    }
  });

  return prisma;
}
