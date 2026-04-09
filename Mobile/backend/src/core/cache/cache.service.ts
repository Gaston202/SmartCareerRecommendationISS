import { Injectable, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private initializeRedis() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.warn('REDIS_URL not set, caching disabled');
      return;
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        retryStrategy: (times) => Math.min(times * 50, 2000),
      });

      this.redis.on('connect', () => {
        this.logger.log('Redis connected');
      });

      this.redis.on('error', (err) => {
        this.logger.error('Redis error', err);
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis disconnected');
      });
    } catch (err) {
      this.logger.error('Failed to initialize Redis', err);
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.warn(`Cache get error for key: ${key}`, err);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (err) {
      this.logger.warn(`Cache set error for key: ${key}`, err);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (err) {
      this.logger.warn(`Cache delete error for key: ${key}`, err);
      return false;
    }
  }

  async invalidatePattern(pattern: string): Promise<number> {
    if (!this.redis) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      const pipeline = this.redis.pipeline();
      keys.forEach((key) => pipeline.del(key));
      const results = await pipeline.exec();
      // Type assertion: each result is [Error | null, number]
      return (results as any[])?.filter((result) => result[1] > 0).length || 0;
    } catch (err) {
      this.logger.warn(`Cache invalidate pattern error: ${pattern}`, err);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.redis) return false;

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (err) {
      this.logger.warn(`Cache exists error for key: ${key}`, err);
      return false;
    }
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.quit();
      this.logger.log('Redis connection closed');
    }
  }
}
