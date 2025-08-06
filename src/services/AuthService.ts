import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, UserDocument } from '@models/User';
import { authConfig } from '@config/index';
import { UserRole, Permission, UserStatus } from '@types/index';
import { RedisService } from './RedisService';
import { EmailService } from './EmailService';
import { LoggerService } from './LoggerService';
import { ApiError } from '@utils/ApiError';

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  employeeId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  department: string;
  role?: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
}

export interface PasswordResetData {
  email: string;
  token: string;
  newPassword: string;
}

export class AuthService {
  private readonly logger = LoggerService.getInstance();
  private readonly redisService = RedisService.getInstance();
  private readonly emailService = EmailService.getInstance();

  /**
   * Register a new user
   */
  async register(registerData: RegisterData): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email: registerData.email.toLowerCase() },
          { employeeId: registerData.employeeId }
        ]
      });

      if (existingUser) {
        throw new ApiError(409, 'User already exists with this email or employee ID');
      }

      // Validate password strength
      this.validatePasswordStrength(registerData.password);

      // Create user
      const user = new User({
        ...registerData,
        email: registerData.email.toLowerCase(),
        status: UserStatus.PENDING,
        permissions: this.getDefaultPermissions(registerData.role || UserRole.EMPLOYEE)
      });

      await user.save();

      // Generate email verification token
      const verificationToken = this.generateVerificationToken();
      user.emailVerificationToken = verificationToken;
      await user.save();

      // Send verification email
      await this.emailService.sendVerificationEmail(user.email, user.firstName, verificationToken);

      // Generate auth tokens
      const tokens = await this.generateTokens(user);

      this.logger.info('User registered successfully', { userId: user.id, email: user.email });

      return { user, tokens };
    } catch (error) {
      this.logger.error('Registration failed', { error: error instanceof Error ? error.message : error, email: registerData.email });
      throw error;
    }
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    try {
      // Find user by email (include password for comparison)
      const user = await User.findOne({ 
        email: credentials.email.toLowerCase(),
        status: { $ne: UserStatus.SUSPENDED }
      }).select('+password');

      if (!user) {
        throw new ApiError(401, 'Invalid email or password');
      }

      // Check if account is locked
      if (user.isAccountLocked()) {
        throw new ApiError(423, 'Account is temporarily locked due to too many failed login attempts');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(credentials.password);
      
      if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        throw new ApiError(401, 'Invalid email or password');
      }

      // Check if account is active
      if (user.status !== UserStatus.ACTIVE) {
        throw new ApiError(401, 'Account is not active. Please contact administrator.');
      }

      // Reset login attempts and update last login
      await user.resetLoginAttempts();
      await user.updateLastLogin();

      // Generate auth tokens
      const tokens = await this.generateTokens(user, credentials.rememberMe);

      this.logger.info('User logged in successfully', { userId: user.id, email: user.email });

      return { user, tokens };
    } catch (error) {
      this.logger.error('Login failed', { error: error instanceof Error ? error.message : error, email: credentials.email });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, authConfig.jwtSecret) as TokenPayload;

      // Check if token is blacklisted
      const isBlacklisted = await this.redisService.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new ApiError(401, 'Token has been revoked');
      }

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new ApiError(401, 'User not found or inactive');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user);

      // Blacklist old refresh token
      await this.blacklistToken(refreshToken);

      this.logger.info('Token refreshed successfully', { userId: user.id });

      return tokens;
    } catch (error) {
      this.logger.error('Token refresh failed', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Logout user and blacklist tokens
   */
  async logout(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // Blacklist access token
      await this.blacklistToken(accessToken);

      // Blacklist refresh token if provided
      if (refreshToken) {
        await this.blacklistToken(refreshToken);
      }

      // Get user ID from token for logging
      try {
        const decoded = jwt.decode(accessToken) as TokenPayload;
        this.logger.info('User logged out successfully', { userId: decoded?.userId });
      } catch {
        // Token might be invalid, but still proceed with logout
        this.logger.info('User logged out');
      }
    } catch (error) {
      this.logger.error('Logout failed', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Verify email address
   */
  async verifyEmail(token: string): Promise<UserDocument> {
    try {
      const user = await User.findOne({
        emailVerificationToken: token,
        status: UserStatus.PENDING
      });

      if (!user) {
        throw new ApiError(400, 'Invalid or expired verification token');
      }

      // Update user status and clear verification token
      user.status = UserStatus.ACTIVE;
      user.emailVerified = true;
      user.emailVerifiedAt = new Date();
      user.emailVerificationToken = undefined;

      await user.save();

      this.logger.info('Email verified successfully', { userId: user.id, email: user.email });

      return user;
    } catch (error) {
      this.logger.error('Email verification failed', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    try {
      const user = await User.findOne({
        email: email.toLowerCase(),
        status: UserStatus.ACTIVE
      });

      if (!user) {
        // Don't reveal if user exists for security
        this.logger.warn('Password reset requested for non-existent user', { email });
        return;
      }

      // Generate reset token
      const resetToken = this.generatePasswordResetToken();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      user.passwordResetToken = resetToken;
      user.passwordResetExpires = resetExpires;
      await user.save();

      // Send reset email
      await this.emailService.sendPasswordResetEmail(user.email, user.firstName, resetToken);

      this.logger.info('Password reset requested', { userId: user.id, email: user.email });
    } catch (error) {
      this.logger.error('Password reset request failed', { error: error instanceof Error ? error.message : error, email });
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(resetData: PasswordResetData): Promise<void> {
    try {
      const user = await User.findOne({
        email: resetData.email.toLowerCase(),
        passwordResetToken: resetData.token,
        passwordResetExpires: { $gt: new Date() }
      });

      if (!user) {
        throw new ApiError(400, 'Invalid or expired reset token');
      }

      // Validate new password
      this.validatePasswordStrength(resetData.newPassword);

      // Update password and clear reset token
      user.password = resetData.newPassword;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;

      await user.save();

      // Invalidate all existing sessions
      await this.invalidateAllUserSessions(user.id);

      this.logger.info('Password reset successfully', { userId: user.id, email: user.email });
    } catch (error) {
      this.logger.error('Password reset failed', { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    try {
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw new ApiError(404, 'User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new ApiError(400, 'Current password is incorrect');
      }

      // Validate new password
      this.validatePasswordStrength(newPassword);

      // Update password
      user.password = newPassword;
      await user.save();

      // Invalidate all existing sessions except current one
      await this.invalidateAllUserSessions(userId);

      this.logger.info('Password changed successfully', { userId });
    } catch (error) {
      this.logger.error('Password change failed', { error: error instanceof Error ? error.message : error, userId });
      throw error;
    }
  }

  /**
   * Verify JWT token and return user data
   */
  async verifyToken(token: string): Promise<UserDocument> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.redisService.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new ApiError(401, 'Token has been revoked');
      }

      // Verify token
      const decoded = jwt.verify(token, authConfig.jwtSecret) as TokenPayload;

      // Get user
      const user = await User.findById(decoded.userId);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new ApiError(401, 'User not found or inactive');
      }

      return user;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new ApiError(401, 'Invalid token');
      }
      throw error;
    }
  }

  /**
   * Check if user has required permission
   */
  async hasPermission(userId: string, permission: Permission): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      return user ? user.hasPermission(permission) : false;
    } catch (error) {
      this.logger.error('Permission check failed', { error: error instanceof Error ? error.message : error, userId, permission });
      return false;
    }
  }

  /**
   * Check if user has required role
   */
  async hasRole(userId: string, role: UserRole): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      return user ? user.hasRole(role) : false;
    } catch (error) {
      this.logger.error('Role check failed', { error: error instanceof Error ? error.message : error, userId, role });
      return false;
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: UserDocument, rememberMe = false): Promise<AuthTokens> {
    const sessionId = crypto.randomUUID();
    
    const payload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      sessionId
    };

    const accessTokenExpiry = rememberMe ? '7d' : authConfig.jwtExpiresIn;
    const refreshTokenExpiry = rememberMe ? '30d' : authConfig.refreshTokenExpiresIn;

    const accessToken = jwt.sign(payload, authConfig.jwtSecret, {
      expiresIn: accessTokenExpiry,
      issuer: 'cteh-api',
      audience: 'cteh-client'
    });

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      authConfig.jwtSecret,
      {
        expiresIn: refreshTokenExpiry,
        issuer: 'cteh-api',
        audience: 'cteh-client'
      }
    );

    // Store session in Redis
    const sessionData = {
      userId: user.id,
      email: user.email,
      role: user.role,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    const sessionTTL = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // 30 days or 7 days
    await this.redisService.setex(`session:${sessionId}`, sessionTTL, JSON.stringify(sessionData));

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getTokenExpiryTime(accessTokenExpiry)
    };
  }

  /**
   * Blacklist a token
   */
  private async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redisService.setex(`blacklist:${token}`, ttl, 'true');
        }
      }
    } catch (error) {
      // Token might be invalid, but still proceed
      this.logger.warn('Failed to blacklist token', { error: error instanceof Error ? error.message : error });
    }
  }

  /**
   * Invalidate all user sessions
   */
  private async invalidateAllUserSessions(userId: string): Promise<void> {
    try {
      const sessionKeys = await this.redisService.keys(`session:*`);
      
      for (const key of sessionKeys) {
        const sessionData = await this.redisService.get(key);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (session.userId === userId) {
            await this.redisService.del(key);
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to invalidate user sessions', { error: error instanceof Error ? error.message : error, userId });
    }
  }

  /**
   * Validate password strength
   */
  private validatePasswordStrength(password: string): void {
    if (password.length < authConfig.passwordMinLength) {
      throw new ApiError(400, `Password must be at least ${authConfig.passwordMinLength} characters long`);
    }

    if (authConfig.requirePasswordComplexity) {
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

      if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        throw new ApiError(400, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
      }
    }
  }

  /**
   * Get default permissions for a role
   */
  private getDefaultPermissions(role: UserRole): Permission[] {
    const basePermissions = [
      Permission.VIEW_SKILLS,
      Permission.GIVE_RECOGNITION,
      Permission.VIEW_RECOGNITION,
      Permission.VIEW_CALENDAR,
      Permission.VIEW_TEAM,
      Permission.VIEW_ANALYTICS
    ];

    switch (role) {
      case UserRole.MANAGER:
        return [
          ...basePermissions,
          Permission.MANAGE_TEAM,
          Permission.CREATE_EVENTS,
          Permission.VIEW_ADVANCED_ANALYTICS
        ];
      
      case UserRole.HR_ADMIN:
        return [
          ...basePermissions,
          Permission.MANAGE_SKILLS,
          Permission.MANAGE_RECOGNITION,
          Permission.MANAGE_CALENDAR,
          Permission.MANAGE_TEAM,
          Permission.MANAGE_INTERVIEWS,
          Permission.VIEW_ADVANCED_ANALYTICS,
          Permission.MANAGE_USERS
        ];
      
      case UserRole.SYSTEM_ADMIN:
        return Object.values(Permission);
      
      case UserRole.MENTOR:
        return [
          ...basePermissions,
          Permission.CONDUCT_INTERVIEW,
          Permission.VIEW_INTERVIEW_RESULTS
        ];
      
      case UserRole.INTERVIEWER:
        return [
          ...basePermissions,
          Permission.CONDUCT_INTERVIEW,
          Permission.VIEW_INTERVIEW_RESULTS,
          Permission.MANAGE_INTERVIEWS
        ];
      
      default:
        return basePermissions;
    }
  }

  /**
   * Generate email verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate password reset token
   */
  private generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get token expiry time in seconds
   */
  private getTokenExpiryTime(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 3600; // Default 1 hour

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 3600;
    }
  }
}

export default AuthService;