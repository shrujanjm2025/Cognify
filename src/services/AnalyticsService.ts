import { LoggerService } from './LoggerService';
import { RedisService } from './RedisService';

export interface AnalyticsEvent {
  eventName: string;
  userId?: string;
  sessionId?: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

export class AnalyticsService {
  private static instance: AnalyticsService;
  private readonly logger = LoggerService.getInstance();
  private readonly redisService = RedisService.getInstance();

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  async trackEvent(
    eventName: string,
    properties: Record<string, unknown> = {},
    userId?: string
  ): Promise<void> {
    try {
      const event: AnalyticsEvent = {
        eventName,
        userId,
        properties,
        timestamp: new Date()
      };

      // Store in Redis for real-time processing
      await this.redisService.lpush(
        'analytics:events',
        JSON.stringify(event)
      );

      this.logger.debug('Analytics event tracked', {
        eventName,
        userId,
        properties: Object.keys(properties)
      });
    } catch (error) {
      this.logger.error('Failed to track analytics event', {
        error: error instanceof Error ? error.message : error,
        eventName,
        userId
      });
    }
  }

  async getEventCount(eventName: string, timeRange: { start: Date; end: Date }): Promise<number> {
    // Placeholder implementation
    return Math.floor(Math.random() * 100);
  }

  async getUserEvents(userId: string, limit = 50): Promise<AnalyticsEvent[]> {
    // Placeholder implementation
    return [];
  }
}

export default AnalyticsService;