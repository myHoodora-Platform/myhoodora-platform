import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './shared/auth/public.decorator';
import { API_VERSION, SUPPORTED_API_VERSIONS } from './shared/http/versioning';

@ApiTags('health')
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
