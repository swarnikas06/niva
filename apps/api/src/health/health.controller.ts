import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthCheckResponse, ReadinessCheckResponse } from '@niva/shared-types';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Default health check probe returning service health and readiness status' })
  @SwaggerResponse({
    status: 200,
    description: 'Process and dependency health status',
  })
  async getHealth(): Promise<ReadinessCheckResponse> {
    return this.healthService.getReadiness();
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe to check if API process is running' })
  @SwaggerResponse({
    status: 200,
    description: 'Process is healthy and running',
  })
  getLiveness(): HealthCheckResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe to check if external dependencies are accessible' })
  @SwaggerResponse({
    status: 200,
    description: 'Readiness report with dependency statuses',
  })
  async getReadiness(): Promise<ReadinessCheckResponse> {
    return this.healthService.getReadiness();
  }
}
