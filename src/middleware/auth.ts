import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserDocument } from '@models/User';
import { AuthService, TokenPayload } from '@services/AuthService';
import { Permission, UserRole } from '@types/index';
import { ApiError } from '@utils/ApiError';
import { LoggerService } from '@services/LoggerService';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
      token?: string;
    }
  }
}

const logger = LoggerService.getInstance();
const authService = new AuthService();

/**
 * Middleware to authenticate JWT tokens
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw ApiError.unauthorized('Access token required');
    }

    // Verify token and get user
    const user = await authService.verifyToken(token);
    
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    logger.warn('Authentication failed', {
      error: error instanceof Error ? error.message : error,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN'
      });
    }
  }
};

/**
 * Middleware to check if user has required permission
 */
export const requirePermission = (permission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const hasPermission = await authService.hasPermission(req.user.id, permission);
      
      if (!hasPermission) {
        throw ApiError.forbidden(`Permission required: ${permission}`);
      }

      next();
    } catch (error) {
      logger.warn('Permission check failed', {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id,
        permission,
        path: req.path
      });

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      } else {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }
    }
  };
};

/**
 * Middleware to check if user has required role
 */
export const requireRole = (role: UserRole) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const hasRole = await authService.hasRole(req.user.id, role);
      
      if (!hasRole) {
        throw ApiError.forbidden(`Role required: ${role}`);
      }

      next();
    } catch (error) {
      logger.warn('Role check failed', {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id,
        requiredRole: role,
        userRole: req.user?.role,
        path: req.path
      });

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      } else {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }
    }
  };
};

/**
 * Middleware to check if user has any of the required roles
 */
export const requireAnyRole = (roles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const hasAnyRole = roles.some(role => req.user!.role === role);
      
      if (!hasAnyRole) {
        throw ApiError.forbidden(`One of these roles required: ${roles.join(', ')}`);
      }

      next();
    } catch (error) {
      logger.warn('Role check failed', {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id,
        requiredRoles: roles,
        userRole: req.user?.role,
        path: req.path
      });

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      } else {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }
    }
  };
};

/**
 * Middleware to check if user owns the resource or has admin privileges
 */
export const requireOwnershipOrRole = (role: UserRole) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Authentication required');
      }

      const resourceUserId = req.params.userId || req.params.id;
      const isOwner = req.user.id === resourceUserId;
      const hasRole = req.user.role === role;

      if (!isOwner && !hasRole) {
        throw ApiError.forbidden('Access denied: not owner or insufficient privileges');
      }

      next();
    } catch (error) {
      logger.warn('Ownership/role check failed', {
        error: error instanceof Error ? error.message : error,
        userId: req.user?.id,
        resourceUserId: req.params.userId || req.params.id,
        requiredRole: role,
        path: req.path
      });

      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
          code: error.code
        });
      } else {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }
    }
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token) {
      return next();
    }

    // Try to verify token, but don't fail if invalid
    try {
      const user = await authService.verifyToken(token);
      req.user = user;
      req.token = token;
    } catch (error) {
      // Log but don't fail
      logger.debug('Optional auth failed', {
        error: error instanceof Error ? error.message : error,
        path: req.path
      });
    }

    next();
  } catch (error) {
    // Unexpected error, continue without auth
    logger.error('Optional auth middleware error', {
      error: error instanceof Error ? error.message : error,
      path: req.path
    });
    next();
  }
};

/**
 * Middleware to validate API key for service-to-service communication
 */
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const validApiKey = process.env.API_KEY;

    if (!apiKey || !validApiKey || apiKey !== validApiKey) {
      throw ApiError.unauthorized('Invalid API key');
    }

    next();
  } catch (error) {
    logger.warn('API key validation failed', {
      error: error instanceof Error ? error.message : error,
      ip: req.ip,
      path: req.path
    });

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid API key',
        code: 'INVALID_API_KEY'
      });
    }
  }
};