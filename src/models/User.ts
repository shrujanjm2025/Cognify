import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User as IUser, UserRole, Permission, UserStatus, UserSkill, UserPreferences } from '@types/index';

// Extend the User interface with Mongoose Document
export interface UserDocument extends IUser, Document {
  _id: mongoose.Types.ObjectId;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  hasPermission(permission: Permission): boolean;
  hasRole(role: UserRole): boolean;
  isAccountLocked(): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  updateLastLogin(): Promise<void>;
}

// User Skills subdocument schema
const UserSkillSchema = new Schema({
  skillId: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
  skillName: { type: String, required: true },
  category: { type: String, enum: Object.values(['technical', 'soft_skills', 'leadership', 'domain_specific', 'tools', 'languages']), required: true },
  level: { type: String, enum: Object.values(['beginner', 'intermediate', 'advanced', 'expert']), required: true },
  endorsements: { type: Number, default: 0 },
  lastAssessed: { type: Date, default: Date.now },
  certifications: [{
    id: String,
    name: String,
    issuedBy: String,
    issuedDate: Date,
    expiryDate: Date,
    credentialId: String,
    verificationUrl: String
  }]
}, { _id: false });

// Notification Settings subdocument schema
const NotificationSettingsSchema = new Schema({
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
  sms: { type: Boolean, default: false },
  inApp: { type: Boolean, default: true },
  frequency: { type: String, enum: ['immediate', 'daily', 'weekly'], default: 'immediate' }
}, { _id: false });

// Privacy Settings subdocument schema
const PrivacySettingsSchema = new Schema({
  profileVisibility: { type: String, enum: ['public', 'team', 'private'], default: 'team' },
  skillsVisible: { type: Boolean, default: true },
  achievementsVisible: { type: Boolean, default: true },
  contactInfoVisible: { type: Boolean, default: false }
}, { _id: false });

// User Preferences subdocument schema
const UserPreferencesSchema = new Schema({
  theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
  notifications: { type: NotificationSettingsSchema, default: {} },
  privacy: { type: PrivacySettingsSchema, default: {} },
  language: { type: String, default: 'en' },
  timezone: { type: String, default: 'UTC' }
}, { _id: false });

// Main User Schema
const UserSchema = new Schema<UserDocument>({
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    validate: {
      validator: function(email: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      },
      message: 'Please provide a valid email address'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false // Don't include password in queries by default
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  avatar: {
    type: String,
    default: null
  },
  department: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.EMPLOYEE,
    index: true
  },
  permissions: [{
    type: String,
    enum: Object.values(Permission)
  }],
  skills: [UserSkillSchema],
  preferences: {
    type: UserPreferencesSchema,
    default: {}
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE,
    index: true
  },
  
  // Authentication & Security fields
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  lastLoginAt: {
    type: Date
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerifiedAt: {
    type: Date
  },
  
  // Tracking fields
  profileCompleteness: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  totalPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  level: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // Metadata
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.emailVerificationToken;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
UserSchema.index({ email: 1, status: 1 });
UserSchema.index({ employeeId: 1, status: 1 });
UserSchema.index({ department: 1, role: 1 });
UserSchema.index({ 'skills.skillId': 1 });
UserSchema.index({ totalPoints: -1 });
UserSchema.index({ level: -1 });
UserSchema.index({ createdAt: -1 });

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function(this: UserDocument) {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Virtual for full name
UserSchema.virtual('fullName').get(function(this: UserDocument) {
  return `${this.firstName} ${this.lastName}`;
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(this: UserDocument, next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Pre-save middleware to calculate profile completeness
UserSchema.pre('save', function(this: UserDocument, next) {
  let completeness = 0;
  const totalFields = 10;

  if (this.firstName) completeness++;
  if (this.lastName) completeness++;
  if (this.email) completeness++;
  if (this.department) completeness++;
  if (this.avatar) completeness++;
  if (this.skills && this.skills.length > 0) completeness++;
  if (this.preferences.language) completeness++;
  if (this.preferences.timezone) completeness++;
  if (this.emailVerified) completeness++;
  if (this.preferences.privacy.profileVisibility) completeness++;

  this.profileCompleteness = Math.round((completeness / totalFields) * 100);
  next();
});

// Instance method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to check if user has specific permission
UserSchema.methods.hasPermission = function(permission: Permission): boolean {
  return this.permissions.includes(permission);
};

// Instance method to check if user has specific role
UserSchema.methods.hasRole = function(role: UserRole): boolean {
  return this.role === role;
};

// Instance method to check if account is locked
UserSchema.methods.isAccountLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Instance method to increment login attempts
UserSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  const maxAttempts = 5;
  const lockTime = 15 * 60 * 1000; // 15 minutes

  // Increment attempts
  this.loginAttempts += 1;

  // Lock account if max attempts reached
  if (this.loginAttempts >= maxAttempts && !this.isAccountLocked()) {
    this.lockUntil = new Date(Date.now() + lockTime);
  }

  await this.save();
};

// Instance method to reset login attempts
UserSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

// Instance method to update last login
UserSchema.methods.updateLastLogin = async function(): Promise<void> {
  this.lastLoginAt = new Date();
  await this.save();
};

// Static method to find by email
UserSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase(), status: UserStatus.ACTIVE });
};

// Static method to find by employee ID
UserSchema.statics.findByEmployeeId = function(employeeId: string) {
  return this.findOne({ employeeId, status: UserStatus.ACTIVE });
};

// Static method to search users
UserSchema.statics.searchUsers = function(query: string, options: { limit?: number; skip?: number; department?: string } = {}) {
  const searchRegex = new RegExp(query, 'i');
  const filter: any = {
    status: UserStatus.ACTIVE,
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { employeeId: searchRegex }
    ]
  };

  if (options.department) {
    filter.department = options.department;
  }

  return this.find(filter)
    .limit(options.limit || 20)
    .skip(options.skip || 0)
    .sort({ firstName: 1, lastName: 1 });
};

// Static method to get users by department
UserSchema.statics.getByDepartment = function(department: string, options: { limit?: number; skip?: number } = {}) {
  return this.find({ department, status: UserStatus.ACTIVE })
    .limit(options.limit || 50)
    .skip(options.skip || 0)
    .sort({ firstName: 1, lastName: 1 });
};

// Static method to get leaderboard
UserSchema.statics.getLeaderboard = function(options: { limit?: number; department?: string } = {}) {
  const filter: any = { status: UserStatus.ACTIVE };
  
  if (options.department) {
    filter.department = options.department;
  }

  return this.find(filter)
    .select('firstName lastName avatar department totalPoints level')
    .sort({ totalPoints: -1, level: -1 })
    .limit(options.limit || 10);
};

// Export the model
export interface UserModel extends Model<UserDocument> {
  findByEmail(email: string): Promise<UserDocument | null>;
  findByEmployeeId(employeeId: string): Promise<UserDocument | null>;
  searchUsers(query: string, options?: { limit?: number; skip?: number; department?: string }): Promise<UserDocument[]>;
  getByDepartment(department: string, options?: { limit?: number; skip?: number }): Promise<UserDocument[]>;
  getLeaderboard(options?: { limit?: number; department?: string }): Promise<UserDocument[]>;
}

export const User = mongoose.model<UserDocument, UserModel>('User', UserSchema);