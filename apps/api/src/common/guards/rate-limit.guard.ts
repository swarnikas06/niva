import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Request } from 'express';

export const RATE_LIMIT_KEY = 'rate_limit';
export interface RateLimitOptions {
  limit: number;
  ttlSeconds: number;
}

export const RateLimit = (limit = 10, ttlSeconds = 60) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, ttlSeconds });

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private redis?: Redis;
  private readonly inMemoryStore = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    try {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
      });
      this.redis.connect().catch(() => {
        this.logger.debug('Redis not available for rate limiting; falling back to in-memory store');
      });
    } catch {
      this.logger.debug('Redis initialization failed; using in-memory rate limiting');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options =
      this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, context.getHandler()) || {
        limit: 10,
        ttlSeconds: 60,
      };

    const request = context.switchToHttp().getRequest<Request>();
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      'unknown-ip';
    const path = request.route?.path || request.path;
    const key = `ratelimit:${path}:${ip}`;

    let currentCount = 0;

    if (this.redis && this.redis.status === 'ready') {
      try {
        currentCount = await this.redis.incr(key);
        if (currentCount === 1) {
          await this.redis.expire(key, options.ttlSeconds);
        }
      } catch {
        currentCount = this.checkInMemory(key, options);
      }
    } else {
      currentCount = this.checkInMemory(key, options);
    }

    if (currentCount > options.limit) {
      this.logger.warn(`Rate limit exceeded for IP ${ip} on ${path} (${currentCount}/${options.limit})`);
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'TOO_MANY_REQUESTS',
            message: `Too many requests. Please wait ${options.ttlSeconds} seconds before retrying.`,
            retryAfter: options.ttlSeconds,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private checkInMemory(key: string, options: RateLimitOptions): number {
    const now = Date.now();
    const entry = this.inMemoryStore.get(key);

    if (!entry || now > entry.resetAt) {
      this.inMemoryStore.set(key, { count: 1, resetAt: now + options.ttlSeconds * 1000 });
      return 1;
    }

    entry.count += 1;
    return entry.count;
  }
}
