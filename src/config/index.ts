import { AppConfig } from '@types/index';

// Environment variable validation and defaults
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'REDIS_URL'
];

const validateEnvironment = (): void => {
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

// Configuration object
export const config: AppConfig = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    apiPrefix: process.env.API_PREFIX || '/api/v1',
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb'
  },

  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI!,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10', 10),
      serverSelectionTimeoutMS: parseInt(process.env.DB_SELECTION_TIMEOUT || '5000', 10),
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT || '45000', 10),
      bufferMaxEntries: 0,
      bufferCommands: false
    }
  },

  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL!,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'cteh:',
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10)
  },

  // Authentication Configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000', 10), // 1 hour in ms
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900000', 10), // 15 minutes in ms
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
    requirePasswordComplexity: process.env.REQUIRE_PASSWORD_COMPLEXITY === 'true'
  },

  // AI Configuration
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    requestTimeout: parseInt(process.env.AI_REQUEST_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
    rateLimitPerMinute: parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE || '60', 10)
  },

  // Azure Configuration
  azure: {
    storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    serviceBusConnectionString: process.env.AZURE_SERVICE_BUS_CONNECTION_STRING || '',
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    subscriptionId: process.env.AZURE_SUBSCRIPTION_ID || '',
    resourceGroup: process.env.AZURE_RESOURCE_GROUP || 'cteh-resources',
    containerName: process.env.AZURE_CONTAINER_NAME || 'cteh-files',
    cdnEndpoint: process.env.AZURE_CDN_ENDPOINT || ''
  },

  // Email Configuration
  email: {
    provider: process.env.EMAIL_PROVIDER || 'smtp',
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'Cognizant Talent Hub',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@cognizant.com'
    },
    templates: {
      welcome: process.env.EMAIL_TEMPLATE_WELCOME || 'welcome',
      resetPassword: process.env.EMAIL_TEMPLATE_RESET_PASSWORD || 'reset-password',
      recognition: process.env.EMAIL_TEMPLATE_RECOGNITION || 'recognition',
      interview: process.env.EMAIL_TEMPLATE_INTERVIEW || 'interview'
    }
  },

  // Security Configuration
  security: {
    rateLimiting: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL === 'true',
      skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
    },
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200
    },
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "https://api.openai.com"]
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    encryption: {
      algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
      keyLength: parseInt(process.env.ENCRYPTION_KEY_LENGTH || '32', 10),
      ivLength: parseInt(process.env.ENCRYPTION_IV_LENGTH || '16', 10)
    }
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '14', 10),
    enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
    enableFile: process.env.LOG_ENABLE_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/cteh.log',
    errorFilePath: process.env.LOG_ERROR_FILE_PATH || './logs/cteh-error.log'
  },

  // File Upload Configuration
  uploads: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedMimeTypes: process.env.UPLOAD_ALLOWED_MIME_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    destination: process.env.UPLOAD_DESTINATION || './uploads',
    useAzureStorage: process.env.USE_AZURE_STORAGE === 'true'
  },

  // WebSocket Configuration
  websocket: {
    enabled: process.env.WEBSOCKET_ENABLED !== 'false',
    port: parseInt(process.env.WEBSOCKET_PORT || '3001', 10),
    cors: {
      origin: process.env.WEBSOCKET_CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    },
    pingTimeout: parseInt(process.env.WEBSOCKET_PING_TIMEOUT || '60000', 10),
    pingInterval: parseInt(process.env.WEBSOCKET_PING_INTERVAL || '25000', 10)
  },

  // Cache Configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '3600', 10), // 1 hour
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD || '600', 10), // 10 minutes
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS || '1000', 10),
    enableCompression: process.env.CACHE_ENABLE_COMPRESSION === 'true'
  },

  // Analytics Configuration
  analytics: {
    enabled: process.env.ANALYTICS_ENABLED !== 'false',
    batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '100', 10),
    flushInterval: parseInt(process.env.ANALYTICS_FLUSH_INTERVAL || '30000', 10), // 30 seconds
    retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '365', 10),
    enableRealTimeMetrics: process.env.ANALYTICS_ENABLE_REAL_TIME === 'true'
  },

  // Scheduler Configuration
  scheduler: {
    enabled: process.env.SCHEDULER_ENABLED !== 'false',
    timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
    maxConcurrentJobs: parseInt(process.env.SCHEDULER_MAX_CONCURRENT_JOBS || '10', 10),
    jobTimeout: parseInt(process.env.SCHEDULER_JOB_TIMEOUT || '300000', 10) // 5 minutes
  },

  // Feature Flags
  features: {
    aiInterviews: process.env.FEATURE_AI_INTERVIEWS !== 'false',
    mentorMatching: process.env.FEATURE_MENTOR_MATCHING !== 'false',
    advancedAnalytics: process.env.FEATURE_ADVANCED_ANALYTICS !== 'false',
    realTimeFeedback: process.env.FEATURE_REAL_TIME_FEEDBACK !== 'false',
    gamification: process.env.FEATURE_GAMIFICATION !== 'false',
    calendarIntegration: process.env.FEATURE_CALENDAR_INTEGRATION !== 'false',
    teamSpaces: process.env.FEATURE_TEAM_SPACES !== 'false',
    skillRecommendations: process.env.FEATURE_SKILL_RECOMMENDATIONS !== 'false'
  }
};

// Initialize configuration
export const initializeConfig = (): void => {
  try {
    validateEnvironment();
    console.log('Configuration initialized successfully');
  } catch (error) {
    console.error('Configuration initialization failed:', error);
    process.exit(1);
  }
};

// Configuration getters with type safety
export const getConfig = (): AppConfig => config;

export const isDevelopment = (): boolean => config.server.environment === 'development';
export const isProduction = (): boolean => config.server.environment === 'production';
export const isTest = (): boolean => config.server.environment === 'test';

// Export individual configuration sections for convenience
export const {
  server: serverConfig,
  database: databaseConfig,
  redis: redisConfig,
  auth: authConfig,
  ai: aiConfig,
  azure: azureConfig,
  email: emailConfig,
  security: securityConfig,
  logging: loggingConfig,
  uploads: uploadsConfig,
  websocket: websocketConfig,
  cache: cacheConfig,
  analytics: analyticsConfig,
  scheduler: schedulerConfig,
  features: featureFlags
} = config;