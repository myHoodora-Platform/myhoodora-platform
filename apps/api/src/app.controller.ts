import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './common/decorators/public.decorator';

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
}
