const { replayly } = require("../../../lib/replayly");

export async function GET(req) {
  const context = replayly.createContext({
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  return replayly.runInContext(context, async () => {
    try {
      throw new Error("Example error for Replayly");
    } catch (err) {
      await replayly.captureResponse({ statusCode: 500 }, err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
