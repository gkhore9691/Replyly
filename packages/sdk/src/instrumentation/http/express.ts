import type { ReplaylyClient } from "../../core/client";

type Request = {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  query?: unknown;
  body?: unknown;
  user?: { id?: string };
};

type Response = {
  statusCode: number;
  send: (body: unknown) => unknown;
  json: (body: unknown) => unknown;
  on: (event: string, fn: () => void) => void;
};

export function createExpressMiddleware(client: ReplaylyClient) {
  return (req: Request, res: Response & { _replaylyBody?: unknown }, next: () => void) => {
    const context = client.createContext(req);

    const originalSend = res.send.bind(res);
    const originalJson = res.json.bind(res);

    res.send = function (body: unknown) {
      res._replaylyBody = body;
      return originalSend(body);
    };

    res.json = function (body: unknown) {
      res._replaylyBody = body;
      return originalJson(body);
    };

    res.on("finish", () => {
      client.captureResponse(res).catch(() => {});
    });

    client.runInContext(context, async () => {
      try {
        next();
      } catch (err) {
        await client.captureResponse(res, err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    });
  };
}
