// Core User and Authentication Types
export interface User {
  id: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  department: string;
  role: UserRole;
  permissions: Permission[];
  skills: UserSkill[];
  preferences: UserPreferences;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export enum UserRole {
  EMPLOYEE = 'employee',
  MANAGER = 'manager',
  HR_ADMIN = 'hr_admin',
  SYSTEM_ADMIN = 'system_admin',
  MENTOR = 'mentor',
  INTERVIEWER = 'interviewer'
}

export enum Permission {
  // Skills Management
  VIEW_SKILLS = 'view_skills',
  MANAGE_SKILLS = 'manage_skills',
  
  // Recognition System
  GIVE_RECOGNITION = 'give_recognition',
  VIEW_RECOGNITION = 'view_recognition',
  MANAGE_RECOGNITION = 'manage_recognition',
  
  // AI Interview
  CONDUCT_INTERVIEW = 'conduct_interview',
  VIEW_INTERVIEW_RESULTS = 'view_interview_results',
  MANAGE_INTERVIEWS = 'manage_interviews',
  
  // Calendar & Events
  VIEW_CALENDAR = 'view_calendar',
  MANAGE_CALENDAR = 'manage_calendar',
  CREATE_EVENTS = 'create_events',
  
  // Team Management
  VIEW_TEAM = 'view_team',
  MANAGE_TEAM = 'manage_team',
  
  // Analytics
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_ADVANCED_ANALYTICS = 'view_advanced_analytics',
  
  // System Administration
  MANAGE_USERS = 'manage_users',
  SYSTEM_CONFIG = 'system_config'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

export interface UserSkill {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  level: SkillLevel;
  endorsements: number;
  lastAssessed: Date;
  certifications: Certification[];
}

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum SkillCategory {
  TECHNICAL = 'technical',
  SOFT_SKILLS = 'soft_skills',
  LEADERSHIP = 'leadership',
  DOMAIN_SPECIFIC = 'domain_specific',
  TOOLS = 'tools',
  LANGUAGES = 'languages'
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  language: string;
  timezone: string;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  inApp: boolean;
  frequency: 'immediate' | 'daily' | 'weekly';
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'team' | 'private';
  skillsVisible: boolean;
  achievementsVisible: boolean;
  contactInfoVisible: boolean;
}

// Skills and Learning Types
export interface Skill {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  tags: string[];
  prerequisites: string[];
  relatedSkills: string[];
  difficulty: SkillLevel;
  estimatedLearningHours: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  targetRole?: string;
  skills: string[];
  modules: LearningModule[];
  estimatedDuration: number;
  difficulty: SkillLevel;
  completionRate: number;
  enrolledUsers: number;
  rating: number;
  isRecommended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string;
  type: ModuleType;
  content: ModuleContent;
  duration: number;
  prerequisites: string[];
  assessments: Assessment[];
  resources: Resource[];
  order: number;
  isCompleted?: boolean;
}

export enum ModuleType {
  VIDEO = 'video',
  ARTICLE = 'article',
  INTERACTIVE = 'interactive',
  QUIZ = 'quiz',
  CODING_LAB = 'coding_lab',
  SIMULATION = 'simulation',
  WEBINAR = 'webinar'
}

export interface ModuleContent {
  url?: string;
  text?: string;
  code?: string;
  slides?: string[];
  exercises?: Exercise[];
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  type: 'coding' | 'multiple_choice' | 'essay' | 'practical';
  difficulty: SkillLevel;
  solution?: string;
  hints: string[];
}

// Recognition and Gamification Types
export interface Recognition {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: RecognitionType;
  category: RecognitionCategory;
  title: string;
  message: string;
  points: number;
  badges: Badge[];
  isPublic: boolean;
  createdAt: Date;
}

export enum RecognitionType {
  PEER_KUDOS = 'peer_kudos',
  MANAGER_RECOGNITION = 'manager_recognition',
  TEAM_ACHIEVEMENT = 'team_achievement',
  MILESTONE_COMPLETION = 'milestone_completion',
  SKILL_MASTERY = 'skill_mastery',
  INNOVATION = 'innovation'
}

export enum RecognitionCategory {
  COLLABORATION = 'collaboration',
  INNOVATION = 'innovation',
  LEADERSHIP = 'leadership',
  TECHNICAL_EXCELLENCE = 'technical_excellence',
  CUSTOMER_FOCUS = 'customer_focus',
  MENTORING = 'mentoring'
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  rarity: BadgeRarity;
  criteria: BadgeCriteria;
  unlockedAt?: Date;
}

export enum BadgeRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

export interface BadgeCriteria {
  type: 'skill_level' | 'recognition_count' | 'learning_completion' | 'team_contribution';
  threshold: number;
  timeframe?: string;
}

// AI Interview Types
export interface Interview {
  id: string;
  candidateId: string;
  interviewerId?: string;
  position: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduledAt: Date;
  duration: number;
  questions: InterviewQuestion[];
  responses: InterviewResponse[];
  evaluation: InterviewEvaluation;
  recording?: InterviewRecording;
  feedback: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum InterviewType {
  TECHNICAL = 'technical',
  BEHAVIORAL = 'behavioral',
  SYSTEM_DESIGN = 'system_design',
  CODING = 'coding',
  LEADERSHIP = 'leadership',
  MIXED = 'mixed'
}

export enum InterviewStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show'
}

export interface InterviewQuestion {
  id: string;
  text: string;
  type: QuestionType;
  category: string;
  difficulty: SkillLevel;
  expectedAnswer?: string;
  scoringCriteria: ScoringCriteria[];
  timeLimit?: number;
}

export enum QuestionType {
  OPEN_ENDED = 'open_ended',
  MULTIPLE_CHOICE = 'multiple_choice',
  CODING = 'coding',
  SCENARIO = 'scenario',
  BEHAVIORAL = 'behavioral'
}

export interface InterviewResponse {
  questionId: string;
  answer: string;
  codeSubmission?: string;
  responseTime: number;
  confidence: number;
  timestamp: Date;
}

export interface InterviewEvaluation {
  overallScore: number;
  categoryScores: CategoryScore[];
  strengths: string[];
  improvementAreas: string[];
  recommendation: InterviewRecommendation;
  aiInsights: AIInsight[];
}

export interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export enum InterviewRecommendation {
  STRONG_HIRE = 'strong_hire',
  HIRE = 'hire',
  MAYBE = 'maybe',
  NO_HIRE = 'no_hire'
}

export interface AIInsight {
  type: 'communication' | 'technical' | 'problem_solving' | 'cultural_fit';
  score: number;
  description: string;
  evidence: string[];
}

// Calendar and Events Types
export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startDate: Date;
  endDate: Date;
  location?: string;
  organizer: string;
  attendees: string[];
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
  reminders: Reminder[];
  status: EventStatus;
  visibility: EventVisibility;
  metadata: EventMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export enum EventType {
  DEPLOYMENT = 'deployment',
  RELEASE = 'release',
  MAINTENANCE = 'maintenance',
  TRAINING = 'training',
  MEETING = 'meeting',
  INTERVIEW = 'interview',
  MILESTONE = 'milestone',
  CELEBRATION = 'celebration',
  DEADLINE = 'deadline'
}

export enum EventStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed'
}

export enum EventVisibility {
  PUBLIC = 'public',
  TEAM = 'team',
  DEPARTMENT = 'department',
  PRIVATE = 'private'
}

// Team and Collaboration Types
export interface Team {
  id: string;
  name: string;
  description: string;
  department: string;
  managerId: string;
  members: TeamMember[];
  achievements: TeamAchievement[];
  projects: Project[];
  skills: TeamSkill[];
  metrics: TeamMetrics;
  settings: TeamSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  joinedAt: Date;
  contributions: Contribution[];
  status: 'active' | 'inactive' | 'on_leave';
}

export enum TeamRole {
  MEMBER = 'member',
  LEAD = 'lead',
  MANAGER = 'manager',
  ADMIN = 'admin'
}

export interface TeamAchievement {
  id: string;
  title: string;
  description: string;
  type: AchievementType;
  points: number;
  unlockedAt: Date;
  contributors: string[];
  evidence: string[];
}

export enum AchievementType {
  PROJECT_COMPLETION = 'project_completion',
  INNOVATION = 'innovation',
  COLLABORATION = 'collaboration',
  LEARNING = 'learning',
  CUSTOMER_SUCCESS = 'customer_success',
  EFFICIENCY = 'efficiency'
}

// Analytics and Metrics Types
export interface AnalyticsData {
  userId?: string;
  teamId?: string;
  departmentId?: string;
  metrics: Metric[];
  timeRange: TimeRange;
  generatedAt: Date;
}

export interface Metric {
  name: string;
  value: number;
  unit: string;
  trend: TrendDirection;
  previousValue?: number;
  target?: number;
  category: MetricCategory;
}

export enum TrendDirection {
  UP = 'up',
  DOWN = 'down',
  STABLE = 'stable'
}

export enum MetricCategory {
  ENGAGEMENT = 'engagement',
  PERFORMANCE = 'performance',
  LEARNING = 'learning',
  COLLABORATION = 'collaboration',
  RETENTION = 'retention',
  SATISFACTION = 'satisfaction'
}

export interface TimeRange {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ApiError[];
  pagination?: PaginationInfo;
  metadata?: Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Configuration and Settings Types
export interface AppConfig {
  database: DatabaseConfig;
  redis: RedisConfig;
  auth: AuthConfig;
  ai: AIConfig;
  azure: AzureConfig;
  email: EmailConfig;
  security: SecurityConfig;
}

export interface DatabaseConfig {
  uri: string;
  options: Record<string, unknown>;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  bcryptRounds: number;
}

export interface AIConfig {
  openaiApiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AzureConfig {
  storageConnectionString: string;
  serviceBusConnectionString: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

// Additional utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Event system types for real-time features
export interface WebSocketEvent {
  type: string;
  payload: unknown;
  userId?: string;
  teamId?: string;
  timestamp: Date;
}

export interface NotificationEvent extends WebSocketEvent {
  type: 'notification';
  payload: {
    id: string;
    title: string;
    message: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    actionUrl?: string;
  };
}

export enum NotificationCategory {
  RECOGNITION = 'recognition',
  LEARNING = 'learning',
  INTERVIEW = 'interview',
  CALENDAR = 'calendar',
  TEAM = 'team',
  SYSTEM = 'system'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}