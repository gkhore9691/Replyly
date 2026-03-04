# @replayly/nextjs

Replayly integration for Next.js applications (App Router).

## Installation

```bash
npm install @replayly/nextjs @replayly/sdk
```

## Usage

### Middleware (App Router)

Create `middleware.ts` in your project root:

```typescript
import { createReplaylyMiddleware } from "@replayly/nextjs";

export const middleware = createReplaylyMiddleware({
  apiKey: process.env.REPLAYLY_API_KEY!,
  environment: process.env.NODE_ENV!,
  maskFields: ["password", "token"],
  ignoreRoutes: ["/_next", "/api/health"],
  captureSearchParams: true,
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### API Routes

Wrap your API route handlers to capture request/response and errors:

```typescript
// app/api/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withReplayly, getReplaylyClient } from "@replayly/nextjs";

async function handler(req: NextRequest) {
  return NextResponse.json({ users: [] });
}

export const GET = withReplayly(handler, getReplaylyClient());
```

### Server Actions

Use the client inside server actions to add breadcrumbs or set user:

```typescript
"use server";

import { getReplaylyClient } from "@replayly/nextjs";

export async function createUser(formData: FormData) {
  const client = getReplaylyClient();
  if (client) {
    await client.trackOperation("create_user", async () => {
      // your logic
    });
  }
}
```
