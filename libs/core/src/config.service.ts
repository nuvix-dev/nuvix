import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Configuration } from '@nuvix/utils';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  getDatabaseConfig(): Configuration['database'] {
    return this.get('database') as Configuration['database'];
  }

  getRedisConfig(): Configuration['redis'] {
    return this.get('redis') as Configuration['redis'];
  }

  get assetConfig(): Configuration['assets'] {
    return this.get('assets') as Configuration['assets'];
  }

  getSmtpConfig(): Configuration['smtp'] {
    return this.get('smtp') as Configuration['smtp'];
  }

  get appLimits(): Configuration['limits'] {
    return this.get('limits') as Configuration['limits'];
  }

  get<T extends keyof Configuration>(propertyPath: T): Configuration[T] {
    return this.configService.get(propertyPath) as any;
  }

  get root() {
    return this.configService;
  }
}
