import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import Redis from 'ioredis';
import {
  HealthCheckResponse,
  ReadinessCheckResponse,
  ComponentHealth,
} from '@niva/shared-types';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(private readonly configService: ConfigService) {}

  getLiveness(): HealthCheckResponse {
    return {
      service: 'niva-api',
      status: 'healthy',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
    };
  }

  async getReadiness(): Promise<ReadinessCheckResponse> {
    const liveness = this.getLiveness();
    const dbHealth = await this.checkPostgres();
    const redisHealth = await this.checkRedis();

    const isReady = dbHealth.status === 'healthy' && redisHealth.status === 'healthy';

    return {
      ...liveness,
      status: isReady ? 'healthy' : 'degraded',
      ready: isReady,
      dependencies: {
        postgres: dbHealth,
        redis: redisHealth,
      },
    };
  }

  private async checkPostgres(): Promise<ComponentHealth> {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    if (!databaseUrl) {
      return {
        status: 'unhealthy',
        message: 'DATABASE_URL is not configured',
        lastChecked: new Date().toISOString(),
      };
    }

    const start = Date.now();
    const pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2000,
    });

    try {
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        return {
          status: 'healthy',
          latencyMs: Date.now() - start,
          lastChecked: new Date().toISOString(),
        };
      } finally {
        client.release();
        await pool.end();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database connection failed';
      this.logger.warn(`PostgreSQL health check failed: ${msg}`);
      return {
        status: 'unhealthy',
        message: msg,
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkRedis(): Promise<ComponentHealth> {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    const start = Date.now();

    const redis = new Redis(redisUrl, {
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      const pong = await redis.ping();
      await redis.quit();

      if (pong === 'PONG') {
        return {
          status: 'healthy',
          latencyMs: Date.now() - start,
          lastChecked: new Date().toISOString(),
        };
      }
      return {
        status: 'unhealthy',
        message: `Unexpected Redis ping response: ${pong}`,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Redis connection failed';
      this.logger.warn(`Redis health check failed: ${msg}`);
      try {
        redis.disconnect();
      } catch {
        // ignore
      }
      return {
        status: 'unhealthy',
        message: msg,
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
      };
    }
  }
}
