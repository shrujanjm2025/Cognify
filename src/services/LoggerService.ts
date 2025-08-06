import winston from 'winston';
import { loggingConfig } from '@config/index';

export class LoggerService {
  private static instance: LoggerService;
  private logger: winston.Logger;

  private constructor() {
    this.logger = this.createLogger();
  }

  public static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService();
    }
    return LoggerService.instance;
  }

  private createLogger(): winston.Logger {
    const transports: winston.transport[] = [];

    // Console transport
    if (loggingConfig.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
              let log = `${timestamp} [${level}]: ${message}`;
              
              if (Object.keys(meta).length > 0) {
                log += ` ${JSON.stringify(meta)}`;
              }
              
              if (stack) {
                log += `\n${stack}`;
              }
              
              return log;
            })
          ),
        })
      );
    }

    // File transports
    if (loggingConfig.enableFile) {
      // Combined log file
      transports.push(
        new winston.transports.File({
          filename: loggingConfig.filePath,
          maxsize: this.parseSize(loggingConfig.maxSize),
          maxFiles: loggingConfig.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );

      // Error log file
      transports.push(
        new winston.transports.File({
          filename: loggingConfig.errorFilePath,
          level: 'error',
          maxsize: this.parseSize(loggingConfig.maxSize),
          maxFiles: loggingConfig.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );
    }

    return winston.createLogger({
      level: loggingConfig.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        loggingConfig.format === 'json' 
          ? winston.format.json()
          : winston.format.simple()
      ),
      transports,
      exitOnError: false,
    });
  }

  private parseSize(size: string): number {
    const match = size.match(/^(\d+)([kmg]?)$/i);
    if (!match) return 20 * 1024 * 1024; // Default 20MB

    const value = parseInt(match[1]);
    const unit = (match[2] || '').toLowerCase();

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  // Log levels
  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: Record<string, unknown>): void {
    this.logger.verbose(message, meta);
  }

  // HTTP request logging
  logRequest(req: any, res: any, responseTime: number): void {
    const meta = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      this.error('HTTP Request Error', meta);
    } else {
      this.info('HTTP Request', meta);
    }
  }

  // Database operation logging
  logDbOperation(operation: string, collection: string, duration: number, error?: Error): void {
    const meta = {
      operation,
      collection,
      duration: `${duration}ms`,
    };

    if (error) {
      this.error(`Database operation failed: ${operation}`, { ...meta, error: error.message });
    } else {
      this.debug(`Database operation: ${operation}`, meta);
    }
  }

  // Authentication logging
  logAuth(event: string, userId?: string, email?: string, ip?: string, error?: string): void {
    const meta = {
      event,
      userId,
      email,
      ip,
      error,
    };

    if (error) {
      this.warn(`Authentication failed: ${event}`, meta);
    } else {
      this.info(`Authentication success: ${event}`, meta);
    }
  }

  // Business logic logging
  logBusinessEvent(event: string, userId?: string, meta?: Record<string, unknown>): void {
    this.info(`Business event: ${event}`, {
      userId,
      ...meta,
    });
  }

  // Performance logging
  logPerformance(operation: string, duration: number, meta?: Record<string, unknown>): void {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    
    this.logger.log(level, `Performance: ${operation}`, {
      duration: `${duration}ms`,
      ...meta,
    });
  }

  // Security logging
  logSecurity(event: string, severity: 'low' | 'medium' | 'high', meta?: Record<string, unknown>): void {
    const message = `Security event: ${event}`;
    
    switch (severity) {
      case 'high':
        this.error(message, { severity, ...meta });
        break;
      case 'medium':
        this.warn(message, { severity, ...meta });
        break;
      default:
        this.info(message, { severity, ...meta });
    }
  }

  // Error logging with context
  logError(error: Error, context?: Record<string, unknown>): void {
    this.error(error.message, {
      stack: error.stack,
      name: error.name,
      ...context,
    });
  }

  // Get the underlying Winston logger for advanced usage
  getLogger(): winston.Logger {
    return this.logger;
  }

  // Create child logger with default metadata
  child(defaultMeta: Record<string, unknown>): winston.Logger {
    return this.logger.child(defaultMeta);
  }

  // Set log level dynamically
  setLevel(level: string): void {
    this.logger.level = level;
  }

  // Get current log level
  getLevel(): string {
    return this.logger.level;
  }
}

export default LoggerService;