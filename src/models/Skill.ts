import mongoose, { Schema, Document, Model } from 'mongoose';
import { Skill as ISkill, SkillCategory, SkillLevel } from '@types/index';

export interface SkillDocument extends ISkill, Document {
  _id: mongoose.Types.ObjectId;
}

const SkillSchema = new Schema<SkillDocument>({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    enum: Object.values(SkillCategory),
    required: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  prerequisites: [{
    type: Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  relatedSkills: [{
    type: Schema.Types.ObjectId,
    ref: 'Skill'
  }],
  difficulty: {
    type: String,
    enum: Object.values(SkillLevel),
    required: true,
    index: true
  },
  estimatedLearningHours: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Metadata for analytics
  totalEnrollments: {
    type: Number,
    default: 0,
    min: 0
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  completionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Industry alignment
  industryRelevance: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  demandScore: {
    type: Number,
    default: 5,
    min: 1,
    max: 10
  },
  
  // Content metadata
  resources: [{
    type: {
      type: String,
      enum: ['video', 'article', 'book', 'course', 'tutorial', 'documentation'],
      required: true
    },
    title: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    provider: String,
    duration: Number, // in minutes
    difficulty: {
      type: String,
      enum: Object.values(SkillLevel)
    },
    rating: {
      type: Number,
      min: 0,
      max: 5
    },
    cost: {
      type: String,
      enum: ['free', 'paid', 'subscription'],
      default: 'free'
    }
  }],
  
  // AI/ML metadata for recommendations
  skillVector: [{
    type: Number
  }], // For similarity calculations
  
  keywords: [{
    type: String,
    lowercase: true
  }],
  
  certifications: [{
    name: String,
    provider: String,
    url: String,
    cost: Number,
    validityPeriod: Number // in months
  }]
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
SkillSchema.index({ name: 'text', description: 'text', tags: 'text' });
SkillSchema.index({ category: 1, difficulty: 1 });
SkillSchema.index({ isActive: 1, category: 1 });
SkillSchema.index({ demandScore: -1, industryRelevance: -1 });
SkillSchema.index({ averageRating: -1, totalEnrollments: -1 });
SkillSchema.index({ tags: 1 });
SkillSchema.index({ keywords: 1 });

// Virtual for popularity score
SkillSchema.virtual('popularityScore').get(function(this: SkillDocument) {
  return (this.totalEnrollments * 0.3) + 
         (this.averageRating * 20 * 0.4) + 
         (this.completionRate * 0.2) + 
         (this.demandScore * 10 * 0.1);
});

// Static methods
SkillSchema.statics.findByCategory = function(category: SkillCategory, options: { limit?: number; skip?: number } = {}) {
  return this.find({ category, isActive: true })
    .limit(options.limit || 20)
    .skip(options.skip || 0)
    .sort({ popularityScore: -1 });
};

SkillSchema.statics.searchSkills = function(query: string, options: { 
  limit?: number; 
  skip?: number; 
  category?: SkillCategory;
  difficulty?: SkillLevel;
} = {}) {
  const filter: any = { 
    isActive: true,
    $text: { $search: query }
  };
  
  if (options.category) {
    filter.category = options.category;
  }
  
  if (options.difficulty) {
    filter.difficulty = options.difficulty;
  }
  
  return this.find(filter, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, popularityScore: -1 })
    .limit(options.limit || 20)
    .skip(options.skip || 0);
};

SkillSchema.statics.getRecommendations = function(
  userSkills: string[], 
  preferences: { 
    categories?: SkillCategory[];
    difficulty?: SkillLevel[];
    maxLearningHours?: number;
  } = {},
  limit = 10
) {
  const filter: any = { 
    isActive: true,
    _id: { $nin: userSkills }
  };
  
  if (preferences.categories && preferences.categories.length > 0) {
    filter.category = { $in: preferences.categories };
  }
  
  if (preferences.difficulty && preferences.difficulty.length > 0) {
    filter.difficulty = { $in: preferences.difficulty };
  }
  
  if (preferences.maxLearningHours) {
    filter.estimatedLearningHours = { $lte: preferences.maxLearningHours };
  }
  
  return this.find(filter)
    .sort({ 
      demandScore: -1, 
      industryRelevance: -1, 
      averageRating: -1,
      popularityScore: -1 
    })
    .limit(limit)
    .populate('prerequisites', 'name difficulty')
    .populate('relatedSkills', 'name category');
};

SkillSchema.statics.getTrendingSkills = function(limit = 10) {
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  return this.aggregate([
    {
      $match: {
        isActive: true,
        updatedAt: { $gte: oneMonthAgo }
      }
    },
    {
      $addFields: {
        trendingScore: {
          $add: [
            { $multiply: ['$demandScore', 2] },
            { $multiply: ['$totalEnrollments', 0.1] },
            { $multiply: ['$averageRating', 3] }
          ]
        }
      }
    },
    {
      $sort: { trendingScore: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

SkillSchema.statics.getSkillGaps = function(userSkills: string[], targetRole?: string) {
  // This would typically involve more complex analysis
  // For now, we'll return skills that are commonly required but missing
  const pipeline: any[] = [
    {
      $match: {
        isActive: true,
        _id: { $nin: userSkills },
        demandScore: { $gte: 7 }
      }
    },
    {
      $sort: { demandScore: -1, industryRelevance: -1 }
    },
    {
      $limit: 15
    }
  ];
  
  if (targetRole) {
    // Add role-specific filtering logic here
    pipeline.unshift({
      $match: {
        $or: [
          { tags: { $regex: targetRole, $options: 'i' } },
          { keywords: { $regex: targetRole, $options: 'i' } }
        ]
      }
    });
  }
  
  return this.aggregate(pipeline);
};

export interface SkillModel extends Model<SkillDocument> {
  findByCategory(category: SkillCategory, options?: { limit?: number; skip?: number }): Promise<SkillDocument[]>;
  searchSkills(query: string, options?: { 
    limit?: number; 
    skip?: number; 
    category?: SkillCategory;
    difficulty?: SkillLevel;
  }): Promise<SkillDocument[]>;
  getRecommendations(
    userSkills: string[], 
    preferences?: { 
      categories?: SkillCategory[];
      difficulty?: SkillLevel[];
      maxLearningHours?: number;
    },
    limit?: number
  ): Promise<SkillDocument[]>;
  getTrendingSkills(limit?: number): Promise<any[]>;
  getSkillGaps(userSkills: string[], targetRole?: string): Promise<any[]>;
}

export const Skill = mongoose.model<SkillDocument, SkillModel>('Skill', SkillSchema);