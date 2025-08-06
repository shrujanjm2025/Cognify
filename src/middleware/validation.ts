import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ApiError } from '@utils/ApiError';
import { LoggerService } from '@services/LoggerService';

const logger = LoggerService.getInstance();

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

/**
 * Generic validation middleware
 */
export const validate = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validationErrors: string[] = [];

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, { abortEarly: false });
      if (error) {
        validationErrors.push(...error.details.map(detail => detail.message));
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query, { abortEarly: false });
      if (error) {
        validationErrors.push(...error.details.map(detail => detail.message));
      }
    }

    // Validate path parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params, { abortEarly: false });
      if (error) {
        validationErrors.push(...error.details.map(detail => detail.message));
      }
    }

    // Validate headers
    if (schema.headers) {
      const { error } = schema.headers.validate(req.headers, { abortEarly: false });
      if (error) {
        validationErrors.push(...error.details.map(detail => detail.message));
      }
    }

    if (validationErrors.length > 0) {
      logger.warn('Request validation failed', {
        errors: validationErrors,
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors.map(error => ({
          code: 'VALIDATION_ERROR',
          message: error
        }))
      });
      return;
    }

    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  // MongoDB ObjectId validation
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),
  optionalObjectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    skip: Joi.number().integer().min(0).optional()
  }),

  // Email
  email: Joi.string().email().required(),
  optionalEmail: Joi.string().email().optional(),

  // Password
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one number and one special character'
    }),

  // Date range
  dateRange: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
  }),

  // Search query
  searchQuery: Joi.object({
    q: Joi.string().min(1).max(100).required(),
    category: Joi.string().optional(),
    limit: Joi.number().integer().min(1).max(50).default(10)
  })
};

// Authentication validation schemas
export const authSchemas = {
  register: {
    body: Joi.object({
      employeeId: Joi.string().required().min(3).max(20),
      email: commonSchemas.email,
      password: commonSchemas.password,
      firstName: Joi.string().required().min(2).max(50),
      lastName: Joi.string().required().min(2).max(50),
      department: Joi.string().required().min(2).max(100),
      role: Joi.string().valid('employee', 'manager', 'hr_admin', 'system_admin', 'mentor', 'interviewer').optional()
    })
  },

  login: {
    body: Joi.object({
      email: commonSchemas.email,
      password: Joi.string().required(),
      rememberMe: Joi.boolean().optional()
    })
  },

  refreshToken: {
    body: Joi.object({
      refreshToken: Joi.string().required()
    })
  },

  forgotPassword: {
    body: Joi.object({
      email: commonSchemas.email
    })
  },

  resetPassword: {
    body: Joi.object({
      email: commonSchemas.email,
      token: Joi.string().required(),
      newPassword: commonSchemas.password
    })
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: commonSchemas.password
    })
  }
};

// Skills validation schemas
export const skillsSchemas = {
  searchSkills: {
    query: Joi.object({
      q: Joi.string().min(1).max(100).required(),
      category: Joi.string().valid('technical', 'soft_skills', 'leadership', 'domain_specific', 'tools', 'languages').optional(),
      difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert').optional(),
      limit: Joi.number().integer().min(1).max(50).default(20),
      skip: Joi.number().integer().min(0).default(0),
      includeAISuggestions: Joi.boolean().optional()
    })
  },

  getRecommendations: {
    query: Joi.object({
      targetRole: Joi.string().max(100).optional(),
      categories: Joi.array().items(Joi.string().valid('technical', 'soft_skills', 'leadership', 'domain_specific', 'tools', 'languages')).optional(),
      difficulty: Joi.array().items(Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert')).optional(),
      limit: Joi.number().integer().min(1).max(20).default(10)
    })
  },

  updateUserSkill: {
    params: Joi.object({
      userId: commonSchemas.objectId,
      skillId: commonSchemas.objectId
    }),
    body: Joi.object({
      level: Joi.string().valid('beginner', 'intermediate', 'advanced', 'expert').optional(),
      endorsements: Joi.number().integer().min(0).optional(),
      certifications: Joi.array().items(Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        issuedBy: Joi.string().required(),
        issuedDate: Joi.date().iso().required(),
        expiryDate: Joi.date().iso().optional(),
        credentialId: Joi.string().optional(),
        verificationUrl: Joi.string().uri().optional()
      })).optional()
    })
  },

  assessSkillGaps: {
    params: Joi.object({
      userId: commonSchemas.objectId
    }),
    query: Joi.object({
      targetRole: Joi.string().max(100).optional()
    })
  }
};

// User validation schemas
export const userSchemas = {
  updateProfile: {
    params: Joi.object({
      userId: commonSchemas.objectId
    }),
    body: Joi.object({
      firstName: Joi.string().min(2).max(50).optional(),
      lastName: Joi.string().min(2).max(50).optional(),
      department: Joi.string().min(2).max(100).optional(),
      avatar: Joi.string().uri().optional(),
      preferences: Joi.object({
        theme: Joi.string().valid('light', 'dark', 'auto').optional(),
        language: Joi.string().min(2).max(5).optional(),
        timezone: Joi.string().optional(),
        notifications: Joi.object({
          email: Joi.boolean().optional(),
          push: Joi.boolean().optional(),
          sms: Joi.boolean().optional(),
          inApp: Joi.boolean().optional(),
          frequency: Joi.string().valid('immediate', 'daily', 'weekly').optional()
        }).optional(),
        privacy: Joi.object({
          profileVisibility: Joi.string().valid('public', 'team', 'private').optional(),
          skillsVisible: Joi.boolean().optional(),
          achievementsVisible: Joi.boolean().optional(),
          contactInfoVisible: Joi.boolean().optional()
        }).optional()
      }).optional()
    })
  },

  searchUsers: {
    query: Joi.object({
      q: Joi.string().min(1).max(100).required(),
      department: Joi.string().optional(),
      role: Joi.string().valid('employee', 'manager', 'hr_admin', 'system_admin', 'mentor', 'interviewer').optional(),
      limit: Joi.number().integer().min(1).max(50).default(20),
      skip: Joi.number().integer().min(0).default(0)
    })
  }
};

// Interview validation schemas
export const interviewSchemas = {
  createInterview: {
    body: Joi.object({
      candidateId: commonSchemas.objectId,
      position: Joi.string().required().min(2).max(100),
      type: Joi.string().valid('technical', 'behavioral', 'system_design', 'coding', 'leadership', 'mixed').required(),
      scheduledAt: Joi.date().iso().greater('now').required(),
      duration: Joi.number().integer().min(15).max(180).required(),
      skills: Joi.array().items(Joi.string()).min(1).required()
    })
  },

  updateInterview: {
    params: Joi.object({
      interviewId: commonSchemas.objectId
    }),
    body: Joi.object({
      status: Joi.string().valid('scheduled', 'in_progress', 'completed', 'cancelled', 'no_show').optional(),
      feedback: Joi.string().max(2000).optional(),
      responses: Joi.array().items(Joi.object({
        questionId: Joi.string().required(),
        answer: Joi.string().required(),
        codeSubmission: Joi.string().optional(),
        responseTime: Joi.number().integer().min(0).required(),
        confidence: Joi.number().min(0).max(10).required()
      })).optional()
    })
  }
};

// Calendar validation schemas
export const calendarSchemas = {
  createEvent: {
    body: Joi.object({
      title: Joi.string().required().min(1).max(200),
      description: Joi.string().max(1000).optional(),
      type: Joi.string().valid('deployment', 'release', 'maintenance', 'training', 'meeting', 'interview', 'milestone', 'celebration', 'deadline').required(),
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
      location: Joi.string().max(200).optional(),
      attendees: Joi.array().items(commonSchemas.objectId).optional(),
      visibility: Joi.string().valid('public', 'team', 'department', 'private').default('team'),
      reminders: Joi.array().items(Joi.object({
        type: Joi.string().valid('email', 'push', 'sms').required(),
        minutesBefore: Joi.number().integer().min(0).required()
      })).optional()
    })
  },

  getEvents: {
    query: Joi.object({
      startDate: Joi.date().iso().required(),
      endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
      type: Joi.string().valid('deployment', 'release', 'maintenance', 'training', 'meeting', 'interview', 'milestone', 'celebration', 'deadline').optional(),
      userId: commonSchemas.optionalObjectId,
      teamId: commonSchemas.optionalObjectId
    })
  }
};

// Recognition validation schemas
export const recognitionSchemas = {
  createRecognition: {
    body: Joi.object({
      toUserId: commonSchemas.objectId,
      type: Joi.string().valid('peer_kudos', 'manager_recognition', 'team_achievement', 'milestone_completion', 'skill_mastery', 'innovation').required(),
      category: Joi.string().valid('collaboration', 'innovation', 'leadership', 'technical_excellence', 'customer_focus', 'mentoring').required(),
      title: Joi.string().required().min(1).max(100),
      message: Joi.string().required().min(1).max(500),
      isPublic: Joi.boolean().default(true),
      points: Joi.number().integer().min(1).max(100).optional()
    })
  },

  getRecognitions: {
    query: Joi.object({
      userId: commonSchemas.optionalObjectId,
      type: Joi.string().valid('peer_kudos', 'manager_recognition', 'team_achievement', 'milestone_completion', 'skill_mastery', 'innovation').optional(),
      category: Joi.string().valid('collaboration', 'innovation', 'leadership', 'technical_excellence', 'customer_focus', 'mentoring').optional(),
      limit: Joi.number().integer().min(1).max(50).default(20),
      skip: Joi.number().integer().min(0).default(0)
    })
  }
};

// File upload validation
export const uploadSchemas = {
  fileUpload: {
    body: Joi.object({
      purpose: Joi.string().valid('avatar', 'document', 'certificate', 'resource').required(),
      description: Joi.string().max(200).optional()
    })
  }
};