import { Module, DynamicModule, Global } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { ReplaylyClient } from "@replayly/sdk";
import type { ReplaylyConfig } from "@replayly/sdk";
import { ReplaylyInterceptor } from "./replayly.interceptor";
import { ReplaylyService } from "./replayly.service";

export interface ReplaylyModuleOptions extends ReplaylyConfig {
  isGlobal?: boolean;
}

@Global()
@Module({})
export class ReplaylyModule {
  static forRoot(options: ReplaylyModuleOptions): DynamicModule {
    const client = new ReplaylyClient(options);

    return {
      module: ReplaylyModule,
      global: options.isGlobal !== false,
      providers: [
        {
          provide: "REPLAYLY_CLIENT",
          useValue: client,
        },
        ReplaylyService,
        {
          provide: APP_INTERCEPTOR,
          useClass: ReplaylyInterceptor,
        },
      ],
      exports: [ReplaylyService, "REPLAYLY_CLIENT"],
    };
  }
}
