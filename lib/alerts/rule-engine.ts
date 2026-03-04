import { prisma } from "@/lib/db/postgres";
import { getOpenSearchClient } from "@/lib/search/opensearch";

export interface AlertCondition {
  type: "error_rate" | "response_time" | "status_code" | "spike" | "custom_query";
  operator: "gt" | "gte" | "lt" | "lte" | "eq";
  threshold: number;
  timeWindow: number;
  aggregation?: "avg" | "p95" | "p99" | "count" | "sum";
  filters?: {
    routes?: string[];
    statusCodes?: number[];
    errorHashes?: string[];
  };
  customQuery?: string;
}

export interface AlertRuleEvaluation {
  ruleId: string;
  triggered: boolean;
  condition: AlertCondition;
  actualValue: number;
  threshold: number;
  message: string;
}

export class AlertRuleEngine {
  async evaluateRule(ruleId: string): Promise<AlertRuleEvaluation | null> {
    const rule = await prisma.alertRule.findUnique({
      where: { id: ruleId },
      include: { project: true },
    });

    if (!rule || !rule.enabled) {
      return null;
    }

    const conditions = rule.conditions as unknown as AlertCondition[];

    for (const condition of conditions) {
      const evaluation = await this.evaluateCondition(rule.projectId, condition);

      if (evaluation.triggered) {
        return {
          ruleId: rule.id,
          ...evaluation,
        };
      }
    }

    return null;
  }

  private async evaluateCondition(
    projectId: string,
    condition: AlertCondition
  ): Promise<Omit<AlertRuleEvaluation, "ruleId">> {
    switch (condition.type) {
      case "error_rate":
        return this.evaluateErrorRate(projectId, condition);
      case "response_time":
        return this.evaluateResponseTime(projectId, condition);
      case "status_code":
        return this.evaluateStatusCode(projectId, condition);
      case "spike":
        return this.evaluateSpike(projectId, condition);
      case "custom_query":
        return this.evaluateCustomQuery(projectId, condition);
      default:
        throw new Error(`Unknown condition type: ${(condition as AlertCondition).type}`);
    }
  }

  private async evaluateErrorRate(
    projectId: string,
    condition: AlertCondition
  ): Promise<Omit<AlertRuleEvaluation, "ruleId">> {
    const since = new Date(Date.now() - condition.timeWindow * 60 * 1000);
    const { mongodb } = await import("@/lib/db/mongodb");
    const db = await mongodb.getDb();

    const totalEvents = await db.collection("events").countDocuments({
      projectId,
      timestamp: { $gte: since },
    });

    const errorEvents = await db.collection("events").countDocuments({
      projectId,
      timestamp: { $gte: since },
      statusCode: { $gte: 400 },
    });

    const errorRate = totalEvents > 0 ? (errorEvents / totalEvents) * 100 : 0;
    const triggered = this.compareValues(errorRate, condition.operator, condition.threshold);

    return {
      triggered,
      condition,
      actualValue: errorRate,
      threshold: condition.threshold,
      message: `Error rate is ${errorRate.toFixed(2)}% (threshold: ${condition.threshold}%)`,
    };
  }

  private async evaluateResponseTime(
    projectId: string,
    condition: AlertCondition
  ): Promise<Omit<AlertRuleEvaluation, "ruleId">> {
    const since = new Date(Date.now() - condition.timeWindow * 60 * 1000);
    const { mongodb } = await import("@/lib/db/mongodb");
    const db = await mongodb.getDb();

    const aggregation = condition.aggregation || "avg";
    const match: Record<string, unknown> = {
      projectId,
      timestamp: { $gte: since },
    };
    if (condition.filters?.routes?.length) {
      match.route = { $in: condition.filters.routes };
    }

    let pipeline: unknown[] = [{ $match: match }];

    if (aggregation === "avg") {
      pipeline.push({
        $group: {
          _id: null,
          value: { $avg: "$durationMs" },
        },
      });
    } else if (aggregation === "p95" || aggregation === "p99") {
      const percentile = aggregation === "p95" ? 0.95 : 0.99;
      pipeline.push(
        { $sort: { durationMs: 1 } },
        {
          $group: {
            _id: null,
            values: { $push: "$durationMs" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            value: {
              $arrayElemAt: ["$values", { $floor: { $multiply: ["$count", percentile] } }],
            },
          },
        }
      );
    } else {
      pipeline.push({
        $group: { _id: null, value: { $avg: "$durationMs" } },
      });
    }

    const result = await db
      .collection("events")
      .aggregate<{ value?: number }>(pipeline as import("mongodb").Document[])
      .toArray();
    const actualValue = result[0]?.value ?? 0;

    const triggered = this.compareValues(actualValue, condition.operator, condition.threshold);

    return {
      triggered,
      condition,
      actualValue,
      threshold: condition.threshold,
      message: `${aggregation.toUpperCase()} response time is ${actualValue.toFixed(2)}ms (threshold: ${condition.threshold}ms)`,
    };
  }

  private async evaluateStatusCode(
    projectId: string,
    condition: AlertCondition
  ): Promise<Omit<AlertRuleEvaluation, "ruleId">> {
    const since = new Date(Date.now() - condition.timeWindow * 60 * 1000);
    const { mongodb } = await import("@/lib/db/mongodb");
    const db = await mongodb.getDb();

    const filter: Record<string, unknown> = {
      projectId,
      timestamp: { $gte: since },
    };
    if (condition.filters?.statusCodes?.length) {
      filter.statusCode = { $in: condition.filters.statusCodes };
    }

    const count = await db.collection("events").countDocuments(filter);

    const triggered = this.compareValues(count, condition.operator, condition.threshold);

    return {
      triggered,
      condition,
      actualValue: count,
      threshold: condition.threshold,
      message: `Status code count is ${count} (threshold: ${condition.threshold})`,
    };
  }

  private async evaluateSpike(
    projectId: string,
    condition: AlertCondition
  ): Promise<Omit<AlertRuleEvaluation, "ruleId">> {
    const now = Date.now();
    const windowMs = condition.timeWindow * 60 * 1000;
    const currentWindow = new Date(now - windowMs);
    const previousWindow = new Date(now - windowMs * 2);

    const { mongodb } = await import("@/lib/db/mongodb");
    const db = await mongodb.getDb();

    const currentCount = await db.collection("events").countDocuments({
      projectId,
      timestamp: { $gte: currentWindow },
      statusCode: { $gte: 400 },
    });

    const previousCount = await db.collection("events").countDocuments({
      projectId,
      timestamp: { $gte: previousWindow, $lt: currentWindow },
      statusCode: { $gte: 400 },
    });

    const spikeMultiplier = previousCount > 0 ? currentCount / previousCount : (currentCount > 0 ? Infinity : 0);
    const triggered = spikeMultiplier >= condition.threshold;

    return {
      triggered,
      condition,
      actualValue: spikeMultiplier,
      threshold: condition.threshold,
      message: `Error spike detected: ${spikeMultiplier.toFixed(2)}x increase (threshold: ${condition.threshold}x)`,
    };
  }

  private async evaluateCustomQuery(
    projectId: string,
    condition: AlertCondition
  ): Promise<Omit<AlertRuleEvaluation, "ruleId">> {
    if (!condition.customQuery) {
      throw new Error("Custom query is required for custom_query condition type");
    }

    const client = getOpenSearchClient();
    const index = `events-${projectId}`;

    let queryClause: Record<string, unknown>;
    try {
      queryClause = JSON.parse(condition.customQuery) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid custom query JSON");
    }

    const response = await client.search({
      index,
      body: {
        query: {
          bool: {
            must: [{ term: { projectId } }, queryClause],
          },
        },
        size: 0,
        track_total_hits: true,
      },
    });

    const total = (response.body as { hits?: { total?: { value?: number } } })?.hits?.total?.value ?? 0;
    const triggered = this.compareValues(total, condition.operator, condition.threshold);

    return {
      triggered,
      condition,
      actualValue: total,
      threshold: condition.threshold,
      message: `Custom query result: ${total} (threshold: ${condition.threshold})`,
    };
  }

  private compareValues(actual: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case "gt":
        return actual > threshold;
      case "gte":
        return actual >= threshold;
      case "lt":
        return actual < threshold;
      case "lte":
        return actual <= threshold;
      case "eq":
        return actual === threshold;
      default:
        return false;
    }
  }
}
