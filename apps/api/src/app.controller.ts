import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './shared/auth/public.decorator';
import { NoRateLimit } from './shared/throttle/throttle.guards';
import { API_VERSION, SUPPORTED_API_VERSIONS } from './shared/http/versioning';

@ApiTags('health')
// The host checks /health every few seconds from one address: under the hourly limit it was refused (429)
// about 40 minutes in, and the host restarted the instance as unhealthy.
@NoRateLimit()
@Controller()
export class AppController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongooseIndicator: MongooseHealthIndicator,
  ) { }

  @Public()
  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Health check', description: 'Returns service status and MongoDB connectivity.' })
  check() {
    return this.health.check([
      () => this.mongooseIndicator.pingCheck('mongodb'),
    ]);
  }

  @Public()
  @Get('version')
  @ApiOperation({ summary: 'API versions', description: 'The current version and every one still served (docs/api-versioning.md).' })
  version() {
    return { current: API_VERSION, supported: SUPPORTED_API_VERSIONS, deprecated: [] as string[] };
  }
}
