# @replayly/nestjs

Replayly module for NestJS.

## Installation

```bash
npm install @replayly/nestjs @replayly/sdk
```

## Usage

Register the module in your app (e.g. `app.module.ts`):

```typescript
import { Module } from "@nestjs/common";
import { ReplaylyModule } from "@replayly/nestjs";

@Module({
  imports: [
    ReplaylyModule.forRoot({
      apiKey: process.env.REPLAYLY_API_KEY!,
      environment: process.env.NODE_ENV,
      maskFields: ["password", "token"],
      isGlobal: true,
    }),
  ],
})
export class AppModule {}
```

The module registers a global interceptor that captures HTTP request/response and errors. Use `ReplaylyService` in your controllers to add breadcrumbs, set user, or track custom operations:

```typescript
import { Controller, Get } from "@nestjs/common";
import { ReplaylyService } from "@replayly/nestjs";

@Controller("api")
export class AppController {
  constructor(private readonly replayly: ReplaylyService) {}

  @Get("users")
  async getUsers() {
    this.replayly.addBreadcrumb("Fetching users");
    this.replayly.setUser({ id: "user-1", email: "u@example.com" });
    return { users: [] };
  }
}
```
