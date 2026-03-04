import "./load-env";

import { Worker } from "bullmq";
import { prisma } from "../../lib/db/postgres";
import { AlertRuleEngine } from "../../lib/alerts/rule-engine";
import { getAlertRedisConnection, alertEvaluationQueue, alertsQueue } from "../../lib/queue/alert-queue";

const connection = getAlertRedisConnection();

async function runEvaluator() {
  const engine = new AlertRuleEngine();

  const worker = new Worker(
    "alert-evaluation",
    async () => {
      const rules = await prisma.alertRule.findMany({
        where: { enabled: true },
        include: { channels: true, project: true },
      });

      for (const rule of rules) {
        try {
          const recentAlert = await prisma.alertHistory.findFirst({
            where: {
              ruleId: rule.id,
              triggeredAt: {
                gte: new Date(Date.now() - rule.throttleMinutes * 60 * 1000),
              },
            },
          });

          if (recentAlert) continue;

          const evaluation = await engine.evaluateRule(rule.id);

          if (evaluation?.triggered) {
            const alertHistory = await prisma.alertHistory.create({
              data: {
                ruleId: rule.id,
                condition: evaluation.condition.type,
                value: evaluation.actualValue,
                threshold: evaluation.threshold,
              },
            });

            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const alertUrl = `${baseUrl}/dashboard/${rule.projectId}/settings/alerts?history=${alertHistory.id}`;

            for (const channel of rule.channels) {
              if (channel.enabled) {
                await alertsQueue.add(
                  "send-notification",
                  {
                    alertHistoryId: alertHistory.id,
                    ruleId: rule.id,
                    channelId: channel.id,
                    message: evaluation.message,
                    projectName: rule.project.name,
                    ruleName: rule.name,
                    alertUrl,
                  },
                  { attempts: 3, backoff: { type: "exponential", delay: 2000 } }
                );
              }
            }
          }
        } catch (err) {
          console.error("[Alert evaluator] Rule", rule.id, err);
        }
      }
    },
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      connection: connection as any,
      concurrency: 1,
    }
  );

  await alertEvaluationQueue.add(
    "evaluate-rules",
    {},
    {
      repeat: { every: 60000 },
      jobId: "alert-evaluation-repeat",
    }
  );

  worker.on("failed", (job, err) => {
    console.error("[Alert evaluator] Job failed", job?.id, err?.message);
  });

  console.log("[Alert evaluator] Started");
}

runEvaluator().catch((err) => {
  console.error("[Alert evaluator]", err);
  process.exit(1);
});
