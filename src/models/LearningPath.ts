import mongoose, { Schema, Document, Model } from 'mongoose';
import { LearningPath as ILearningPath, LearningModule, ModuleType, SkillLevel } from '@types/index';

export interface LearningPathDocument extends ILearningPath, Document {
  _id: mongoose.Types.ObjectId;
}

const AssessmentSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['quiz', 'coding', 'project', 'peer_review'],
    required: true
  },
  questions: [{
    question: String,
    options: [String],
    correctAnswer: String,
    explanation: String,
    points: { type: Number, default: 1 }
  }],
  passingScore: {
    type: Number,
    default: 70,
    min: 0,
    max: 100
  },
  timeLimit: Number, // in minutes
  attempts: {
    type: Number,
    default: 3
  }
}, { _id: false });

const ResourceSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['video', 'article', 'book', 'tool', 'documentation', 'template'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  description: String,
  duration: Number, // in minutes
  difficulty: {
    type: String,
    enum: Object.values(SkillLevel)
  },
  isRequired: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const ExerciseSchema = new Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['coding', 'multiple_choice', 'essay', 'practical'],
    required: true
  },
  difficulty: {
    type: String,
    enum: Object.values(SkillLevel),
    required: true
  },
  solution: String,
  hints: [String],
  timeEstimate: Number, // in minutes
  points: {
    type: Number,
    default: 10
  }
}, { _id: false });

const ModuleContentSchema = new Schema({
  url: String,
  text: String,
  code: String,
  slides: [String],
  exercises: [ExerciseSchema]
}, { _id: false });

const LearningModuleSchema = new Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: Object.values(ModuleType),
    required: true
  },
  content: {
    type: ModuleContentSchema,
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  prerequisites: [{
    type: Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  assessments: [AssessmentSchema],
  resources: [ResourceSchema],
  order: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Learning objectives
  objectives: [{
    type: String,
    required: true
  }],
  
  // Skills gained from this module
  skillsGained: [{
    skillId: {
      type: Schema.Types.ObjectId,
      ref: 'Skill',
      required: true
    },
    proficiencyGain: {
      type: Number,
      min: 1,
      max: 100,
      default: 10
    }
  }]
}, { _id: false });

const LearningPathSchema = new Schema<LearningPathDocument>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  targetRole: {
    type: String,
    trim: true,
    index: true
  },
  skills: [{
    type: Schema.Types.ObjectId,
    ref: 'Skill',
    required: true
  }],
  modules: [LearningModuleSchema],
  estimatedDuration: {
    type: Number,
    required: true,
    min: 1 // in hours
  },
  difficulty: {
    type: String,
    enum: Object.values(SkillLevel),
    required: true,
    index: true
  },
  completionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  enrolledUsers: {
    type: Number,
    default: 0,
    min: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  isRecommended: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Path metadata
  category: {
    type: String,
    enum: ['technical', 'leadership', 'soft_skills', 'certification', 'career_transition'],
    required: true,
    index: true
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Prerequisites
  prerequisites: [{
    type: Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  
  // Certification info
  certification: {
    available: {
      type: Boolean,
      default: false
    },
    provider: String,
    name: String,
    cost: Number,
    validityPeriod: Number // in months
  },
  
  // Content creator/owner
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Visibility and access
  isPublic: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Analytics
  totalCompletions: {
    type: Number,
    default: 0
  },
  averageCompletionTime: {
    type: Number,
    default: 0 // in hours
  },
  
  // AI/ML features
  recommendationScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Versioning
  version: {
    type: String,
    default: '1.0.0'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
LearningPathSchema.index({ title: 'text', description: 'text', tags: 'text' });
LearningPathSchema.index({ category: 1, difficulty: 1 });
LearningPathSchema.index({ isActive: 1, isPublic: 1 });
LearningPathSchema.index({ rating: -1, enrolledUsers: -1 });
LearningPathSchema.index({ isRecommended: 1, category: 1 });
LearningPathSchema.index({ targetRole: 1 });
LearningPathSchema.index({ skills: 1 });

// Virtual for popularity score
LearningPathSchema.virtual('popularityScore').get(function(this: LearningPathDocument) {
  return (this.enrolledUsers * 0.4) + 
         (this.rating * 20 * 0.3) + 
         (this.completionRate * 0.2) + 
         (this.totalCompletions * 0.1);
});

// Static methods
LearningPathSchema.statics.findByCategory = function(category: string, options: { 
  limit?: number; 
  skip?: number; 
  difficulty?: SkillLevel;
} = {}) {
  const filter: any = { 
    category, 
    isActive: true, 
    isPublic: true 
  };
  
  if (options.difficulty) {
    filter.difficulty = options.difficulty;
  }
  
  return this.find(filter)
    .populate('skills', 'name category')
    .populate('createdBy', 'firstName lastName')
    .limit(options.limit || 20)
    .skip(options.skip || 0)
    .sort({ popularityScore: -1, rating: -1 });
};

LearningPathSchema.statics.searchPaths = function(query: string, options: { 
  limit?: number; 
  skip?: number; 
  category?: string;
  difficulty?: SkillLevel;
  targetRole?: string;
} = {}) {
  const filter: any = { 
    isActive: true,
    isPublic: true,
    $text: { $search: query }
  };
  
  if (options.category) {
    filter.category = options.category;
  }
  
  if (options.difficulty) {
    filter.difficulty = options.difficulty;
  }
  
  if (options.targetRole) {
    filter.targetRole = new RegExp(options.targetRole, 'i');
  }
  
  return this.find(filter, { score: { $meta: 'textScore' } })
    .populate('skills', 'name category')
    .populate('createdBy', 'firstName lastName')
    .sort({ score: { $meta: 'textScore' }, popularityScore: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0);
};

LearningPathSchema.statics.getRecommendations = function(
  userSkills: string[],
  userRole?: string,
  preferences: {
    categories?: string[];
    difficulty?: SkillLevel[];
    maxDuration?: number;
  } = {},
  limit = 10
) {
  const pipeline: any[] = [
    {
      $match: {
        isActive: true,
        isPublic: true
      }
    }
  ];
  
  // Add role-based filtering
  if (userRole) {
    pipeline.push({
      $match: {
        $or: [
          { targetRole: new RegExp(userRole, 'i') },
          { tags: { $regex: userRole, $options: 'i' } }
        ]
      }
    });
  }
  
  // Add preference filters
  if (preferences.categories && preferences.categories.length > 0) {
    pipeline.push({
      $match: { category: { $in: preferences.categories } }
    });
  }
  
  if (preferences.difficulty && preferences.difficulty.length > 0) {
    pipeline.push({
      $match: { difficulty: { $in: preferences.difficulty } }
    });
  }
  
  if (preferences.maxDuration) {
    pipeline.push({
      $match: { estimatedDuration: { $lte: preferences.maxDuration } }
    });
  }
  
  // Calculate recommendation score based on user skills
  pipeline.push({
    $addFields: {
      skillsOverlap: {
        $size: {
          $setIntersection: ['$skills', userSkills.map(id => new mongoose.Types.ObjectId(id))]
        }
      },
      newSkillsCount: {
        $size: {
          $setDifference: ['$skills', userSkills.map(id => new mongoose.Types.ObjectId(id))]
        }
      }
    }
  });
  
  pipeline.push({
    $addFields: {
      personalizedScore: {
        $add: [
          { $multiply: ['$rating', 20] },
          { $multiply: ['$skillsOverlap', 5] },
          { $multiply: ['$newSkillsCount', 3] },
          { $multiply: ['$completionRate', 0.5] }
        ]
      }
    }
  });
  
  pipeline.push({
    $sort: { personalizedScore: -1, isRecommended: -1 }
  });
  
  pipeline.push({ $limit: limit });
  
  pipeline.push({
    $lookup: {
      from: 'skills',
      localField: 'skills',
      foreignField: '_id',
      as: 'skills'
    }
  });
  
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'createdBy',
      foreignField: '_id',
      as: 'createdBy'
    }
  });
  
  return this.aggregate(pipeline);
};

LearningPathSchema.statics.getPopularPaths = function(limit = 10) {
  return this.find({ 
    isActive: true, 
    isPublic: true 
  })
    .populate('skills', 'name category')
    .populate('createdBy', 'firstName lastName')
    .sort({ 
      enrolledUsers: -1, 
      rating: -1, 
      totalCompletions: -1 
    })
    .limit(limit);
};

LearningPathSchema.statics.getNewPaths = function(limit = 10) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  return this.find({ 
    isActive: true, 
    isPublic: true,
    createdAt: { $gte: oneMonthAgo }
  })
    .populate('skills', 'name category')
    .populate('createdBy', 'firstName lastName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

export interface LearningPathModel extends Model<LearningPathDocument> {
  findByCategory(category: string, options?: { 
    limit?: number; 
    skip?: number; 
    difficulty?: SkillLevel;
  }): Promise<LearningPathDocument[]>;
  searchPaths(query: string, options?: { 
    limit?: number; 
    skip?: number; 
    category?: string;
    difficulty?: SkillLevel;
    targetRole?: string;
  }): Promise<LearningPathDocument[]>;
  getRecommendations(
    userSkills: string[],
    userRole?: string,
    preferences?: {
      categories?: string[];
      difficulty?: SkillLevel[];
      maxDuration?: number;
    },
    limit?: number
  ): Promise<any[]>;
  getPopularPaths(limit?: number): Promise<LearningPathDocument[]>;
  getNewPaths(limit?: number): Promise<LearningPathDocument[]>;
}

export const LearningPath = mongoose.model<LearningPathDocument, LearningPathModel>('LearningPath', LearningPathSchema);