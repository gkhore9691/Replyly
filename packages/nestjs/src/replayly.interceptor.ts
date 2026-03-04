// @ts-nocheck
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import type { ReplaylyClient } from "@replayly/sdk";
import type { RequestContext } from "@replayly/sdk";

@Injectable()
export class ReplaylyInterceptor implements NestInterceptor {
  constructor(
    @Inject("REPLAYLY_CLIENT")
    private readonly client: ReplaylyClient
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const replaylyContext = this.client.createContext({
      method: request.method,
      url: request.url ?? request.originalUrl ?? "",
      headers: (request.headers ?? {}) as Record<string, unknown>,
      query: request.query ?? {},
      body: request.body ?? null,
    });

    (request as Record<string, unknown>).replaylyContext = replaylyContext;

    return next.handle().pipe(
      tap((data: unknown) => {
        replaylyContext.response = {
          statusCode: response.statusCode,
          headers: (response.getHeaders?.() ?? {}) as Record<string, string>,
          body: data,
        };
        replaylyContext.durationMs = Date.now() - replaylyContext.startTime;
        void this.client.sendEvent(replaylyContext);
      }),
      catchError((error: unknown) => {
        replaylyContext.error = {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : "Error",
        };
        replaylyContext.durationMs = Date.now() - replaylyContext.startTime;
        void this.client.sendEvent(replaylyContext);
        return throwError(() => error);
      })
    );
  }
}
