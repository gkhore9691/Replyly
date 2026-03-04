import { prisma } from "../../../lib/db/postgres";

export interface EventAnalytics {
  projectId: string;
  timestamp: Date;
  durationMs: number;
  isError: boolean;
}

export async function storeEventAnalytics(
  event: EventAnalytics
): Promise<void> {
  const date = new Date(event.timestamp);
  date.setHours(0, 0, 0, 0);

  await prisma.dailyStats.upsert({
    where: {
      projectId_date: {
        projectId: event.projectId,
        date,
      },
    },
    create: {
      projectId: event.projectId,
      date,
      totalEvents: 1,
      errorEvents: event.isError ? 1 : 0,
      avgDurationMs: event.durationMs,
      p95DurationMs: event.durationMs,
      p99DurationMs: event.durationMs,
    },
    update: {
      totalEvents: { increment: 1 },
      errorEvents: { increment: event.isError ? 1 : 0 },
    },
  });
}
