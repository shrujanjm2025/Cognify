import Redis, { RedisOptions } from 'ioredis';
import { redisConfig } from '@config/index';
import { LoggerService } from './LoggerService';

export class RedisService {
  private static instance: RedisService;
  private client: Redis;
  private readonly logger = LoggerService.getInstance();

  private constructor() {
    const options: RedisOptions = {
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      keyPrefix: redisConfig.keyPrefix,
      retryDelayOnFailover: redisConfig.retryDelayOnFailover,
      maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
      lazyConnect: true,
      enableReadyCheck: true,
      maxLoadingTimeout: 5000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };

    this.client = new Redis(options);
    this.setupEventListeners();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private setupEventListeners(): void {
    this.client.on('connect', () => {
      this.logger.info('Redis connection established');
    });

    this.client.on('ready', () => {
      this.logger.info('Redis is ready to receive commands');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error', { error: error.message });
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Redis reconnecting...');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.info('Successfully connected to Redis');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.info('Redis connection closed gracefully');
    } catch (error) {
      this.logger.error('Error closing Redis connection', { error: error instanceof Error ? error.message : error });
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error('Redis GET error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error('Redis SET error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    try {
      await this.client.setex(key, ttl, value);
    } catch (error) {
      this.logger.error('Redis SETEX error', { key, ttl, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      this.logger.error('Redis DEL error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error('Redis EXISTS error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error('Redis EXPIRE error', { key, ttl, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error('Redis TTL error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error('Redis KEYS error', { pattern, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      this.logger.error('Redis HGET error', { key, field, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hset(key, field, value);
    } catch (error) {
      this.logger.error('Redis HSET error', { key, field, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      this.logger.error('Redis HGETALL error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async hdel(key: string, field: string): Promise<number> {
    try {
      return await this.client.hdel(key, field);
    } catch (error) {
      this.logger.error('Redis HDEL error', { key, field, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async sadd(key: string, member: string): Promise<number> {
    try {
      return await this.client.sadd(key, member);
    } catch (error) {
      this.logger.error('Redis SADD error', { key, member, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async srem(key: string, member: string): Promise<number> {
    try {
      return await this.client.srem(key, member);
    } catch (error) {
      this.logger.error('Redis SREM error', { key, member, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error('Redis SMEMBERS error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      this.logger.error('Redis SISMEMBER error', { key, member, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async lpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.lpush(key, value);
    } catch (error) {
      this.logger.error('Redis LPUSH error', { key, value, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      this.logger.error('Redis RPOP error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.client.llen(key);
    } catch (error) {
      this.logger.error('Redis LLEN error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error('Redis INCR error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async incrby(key: string, increment: number): Promise<number> {
    try {
      return await this.client.incrby(key, increment);
    } catch (error) {
      this.logger.error('Redis INCRBY error', { key, increment, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error('Redis DECR error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  // Cache helper methods
  async getJson<T>(key: string): Promise<T | null> {
    try {
      const value = await this.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error('Redis JSON GET error', { key, error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  async setJson<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await this.set(key, jsonValue, ttl);
    } catch (error) {
      this.logger.error('Redis JSON SET error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  // Rate limiting helper
  async rateLimit(key: string, limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const current = await this.incr(key);
      
      if (current === 1) {
        await this.expire(key, Math.ceil(windowMs / 1000));
      }

      const ttl = await this.ttl(key);
      const resetTime = Date.now() + (ttl * 1000);

      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetTime
      };
    } catch (error) {
      this.logger.error('Redis rate limit error', { key, error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed', { error: error instanceof Error ? error.message : error });
      return false;
    }
  }

  // Get Redis client for advanced operations
  getClient(): Redis {
    return this.client;
  }
}

export default RedisService;