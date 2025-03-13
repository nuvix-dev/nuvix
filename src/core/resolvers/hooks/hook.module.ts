import { Module } from '@nestjs/common';
import { HookManager } from './hook.manager';
import { ProjectHook } from './project.hook';
import { AuthHook } from './auth.hook';
import { HostHook } from './host.hook';
import { ApiHook } from './api.hook';
import { ProjectUsageHook } from './project-usage.hook';
import { CorsHook } from './cors.hook';
import { HOOKS } from 'src/Utils/constants';

@Module({
  providers: [
    {
      provide: HOOKS,
      // For less repetition, pass hooks as a rest parameter
      useFactory: (
        ...hooks: [
          ProjectHook,
          AuthHook,
          HostHook,
          ApiHook,
          ProjectUsageHook,
          CorsHook,
        ]
      ) => hooks,
      inject: [
        ProjectHook,
        AuthHook,
        HostHook,
        ApiHook,
        ProjectUsageHook,
        CorsHook,
      ],
    },
    HookManager,
    ProjectHook,
    AuthHook,
    HostHook,
    ApiHook,
    ProjectUsageHook,
    CorsHook,
  ],
  exports: [HookManager],
})
export class HookModule {}
