const { replayly } = require("../../../lib/replayly");

export async function GET(req) {
  const context = replayly.createContext({
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  return replayly.runInContext(context, async () => {
    const body = { message: "Hello from Replayly example" };
    await replayly.captureResponse({ statusCode: 200, _replaylyBody: body });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}
