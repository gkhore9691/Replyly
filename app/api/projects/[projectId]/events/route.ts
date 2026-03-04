import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/verify";
import { verifyProjectAccess } from "@/lib/auth/project-access";
import { mongodb } from "@/lib/db/mongodb";
import { searchEvents } from "@/lib/search/opensearch";
import { z } from "zod";

const QuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  route: z.string().optional(),
  method: z.string().optional(),
  statusCode: z.coerce.number().optional(),
  statusCodeMin: z.coerce.number().optional(),
  statusCodeMax: z.coerce.number().optional(),
  isError: z
    .string()
    .optional()
    .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
  environment: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  errorHash: z.string().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const hasAccess = await verifyProjectAccess(user.user.userId, projectId);
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const query = QuerySchema.parse(searchParams);

    const filter: Record<string, unknown> = {
      projectId,
    };

    if (query.route) filter.route = query.route;
    if (query.method) filter.method = query.method.toUpperCase();
    if (query.statusCodeMin !== undefined || query.statusCodeMax !== undefined) {
      filter.statusCode = {};
      if (query.statusCodeMin !== undefined) {
        (filter.statusCode as Record<string, number>).$gte = query.statusCodeMin;
      }
      if (query.statusCodeMax !== undefined) {
        (filter.statusCode as Record<string, number>).$lte = query.statusCodeMax;
      }
    } else if (query.statusCode !== undefined) {
      filter.statusCode = query.statusCode;
    }
    if (query.isError !== undefined) filter.isError = query.isError;
    if (query.environment) filter.environment = query.environment;
    if (query.errorHash) filter.errorHash = query.errorHash;

    if (query.startDate || query.endDate) {
      filter.timestamp = {};
      if (query.startDate) {
        (filter.timestamp as Record<string, Date>).$gte = new Date(
          query.startDate
        );
      }
      if (query.endDate) {
        (filter.timestamp as Record<string, Date>).$lte = new Date(
          query.endDate
        );
      }
    }

    let requestIds: string[] | null = null;
    if (query.search?.trim()) {
      const searchResults = await searchEvents(projectId, query.search.trim());
      requestIds = searchResults
        .map((r) => r.requestId as string | undefined)
        .filter((id): id is string => Boolean(id));
      if (requestIds.length === 0) {
        return NextResponse.json({
          events: [],
          pagination: {
            page: query.page,
            limit: query.limit,
            total: 0,
            pages: 0,
          },
        });
      }
      filter.requestId = { $in: requestIds };
    }

    const db = await mongodb.getDb();
    const collection = db.collection("events");

    const skip = (query.page - 1) * query.limit;

    const [events, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(query.limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    const serializedEvents = events.map((e) => {
      const doc = e as Record<string, unknown>;
      return {
        ...doc,
        _id: doc._id?.toString?.() ?? doc._id,
        timestamp:
          doc.timestamp instanceof Date
            ? doc.timestamp.toISOString()
            : doc.timestamp,
      };
    });

    return NextResponse.json({
      events: serializedEvents,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (process.env.NODE_ENV === "development") {
      console.error("[GET /api/projects/.../events]", err);
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        ...(process.env.NODE_ENV === "development" && { detail: message }),
      },
      { status: 500 }
    );
  }
}
