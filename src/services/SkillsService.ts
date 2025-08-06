import { Skill, SkillDocument } from '@models/Skill';
import { LearningPath, LearningPathDocument } from '@models/LearningPath';
import { User, UserDocument } from '@models/User';
import { AIService } from './AIService';
import { RedisService } from './RedisService';
import { LoggerService } from './LoggerService';
import { AnalyticsService } from './AnalyticsService';
import { 
  SkillCategory, 
  SkillLevel, 
  UserSkill,
  ApiResponse,
  PaginationInfo
} from '@types/index';
import { ApiError } from '@utils/ApiError';

export interface SkillAssessment {
  skillId: string;
  currentLevel: SkillLevel;
  targetLevel: SkillLevel;
  gapAnalysis: {
    missingAreas: string[];
    recommendedActions: string[];
    estimatedTime: number;
  };
  resources: {
    type: string;
    title: string;
    url: string;
    difficulty: SkillLevel;
  }[];
}

export interface SkillsAnalytics {
  totalSkills: number;
  skillsByCategory: Record<SkillCategory, number>;
  averageLevel: number;
  completedCertifications: number;
  learningHours: number;
  progressMetrics: {
    skillsGained: number;
    levelsAdvanced: number;
    certificationsEarned: number;
    period: string;
  };
}

export interface TeamSkillsOverview {
  teamId: string;
  totalMembers: number;
  skillCoverage: {
    skillId: string;
    skillName: string;
    category: SkillCategory;
    membersWithSkill: number;
    averageLevel: number;
    expertCount: number;
  }[];
  skillGaps: {
    skillId: string;
    skillName: string;
    priority: number;
    recommendedMembers: string[];
  }[];
  recommendations: {
    type: 'hire' | 'train' | 'cross_train';
    description: string;
    priority: number;
  }[];
}

export class SkillsService {
  private readonly aiService = AIService.getInstance();
  private readonly redisService = RedisService.getInstance();
  private readonly logger = LoggerService.getInstance();
  private readonly analyticsService = AnalyticsService.getInstance();

  /**
   * Get personalized skill recommendations for a user
   */
  async getPersonalizedRecommendations(
    userId: string,
    options: {
      targetRole?: string;
      categories?: SkillCategory[];
      difficulty?: SkillLevel[];
      limit?: number;
    } = {}
  ): Promise<ApiResponse<any[]>> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found');
      }

      // Get all available skills for recommendations
      const availableSkills = await Skill.find({ 
        isActive: true,
        ...(options.categories && { category: { $in: options.categories } }),
        ...(options.difficulty && { difficulty: { $in: options.difficulty } })
      });

      // Generate AI-powered recommendations
      const aiRecommendations = await this.aiService.generateSkillRecommendations(
        user,
        availableSkills,
        options.targetRole,
        options.limit || 10
      );

      // Get data-driven recommendations based on user behavior
      const dataRecommendations = await this.getDataDrivenRecommendations(user, options);

      // Combine and rank recommendations
      const combinedRecommendations = this.combineRecommendations(
        aiRecommendations,
        dataRecommendations
      );

      // Track analytics
      await this.analyticsService.trackEvent('skill_recommendations_viewed', {
        userId,
        targetRole: options.targetRole,
        recommendationCount: combinedRecommendations.length
      });

      this.logger.info('Generated personalized skill recommendations', {
        userId,
        targetRole: options.targetRole,
        recommendationCount: combinedRecommendations.length
      });

      return {
        success: true,
        data: combinedRecommendations.slice(0, options.limit || 10),
        metadata: {
          aiRecommendations: aiRecommendations.length,
          dataRecommendations: dataRecommendations.length,
          targetRole: options.targetRole
        }
      };
    } catch (error) {
      this.logger.error('Failed to get personalized recommendations', {
        error: error instanceof Error ? error.message : error,
        userId,
        options
      });
      throw error;
    }
  }

  /**
   * Assess user's skill gaps and provide improvement plan
   */
  async assessSkillGaps(
    userId: string,
    targetRole?: string
  ): Promise<ApiResponse<SkillAssessment[]>> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found');
      }

      const userSkillIds = user.skills.map(s => s.skillId);
      const assessments: SkillAssessment[] = [];

      // Analyze each user skill
      for (const userSkill of user.skills) {
        const skill = await Skill.findById(userSkill.skillId);
        if (!skill) continue;

        const assessment = await this.createSkillAssessment(userSkill, skill, targetRole);
        assessments.push(assessment);
      }

      // Find missing critical skills
      const criticalSkills = await this.getCriticalSkillsForRole(targetRole);
      for (const criticalSkill of criticalSkills) {
        if (!userSkillIds.includes(criticalSkill._id.toString())) {
          const assessment = await this.createSkillAssessment(
            {
              skillId: criticalSkill._id.toString(),
              skillName: criticalSkill.name,
              category: criticalSkill.category,
              level: SkillLevel.BEGINNER,
              endorsements: 0,
              lastAssessed: new Date(),
              certifications: []
            },
            criticalSkill,
            targetRole
          );
          assessments.push(assessment);
        }
      }

      // Sort by priority (gap size and importance)
      assessments.sort((a, b) => {
        const aGap = this.calculateSkillGap(a.currentLevel, a.targetLevel);
        const bGap = this.calculateSkillGap(b.currentLevel, b.targetLevel);
        return bGap - aGap;
      });

      this.logger.info('Completed skill gap assessment', {
        userId,
        targetRole,
        assessmentCount: assessments.length
      });

      return {
        success: true,
        data: assessments,
        metadata: {
          totalSkills: user.skills.length,
          gapsIdentified: assessments.filter(a => a.currentLevel !== a.targetLevel).length,
          targetRole
        }
      };
    } catch (error) {
      this.logger.error('Failed to assess skill gaps', {
        error: error instanceof Error ? error.message : error,
        userId,
        targetRole
      });
      throw error;
    }
  }

  /**
   * Get user's skills analytics and progress
   */
  async getSkillsAnalytics(userId: string): Promise<ApiResponse<SkillsAnalytics>> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found');
      }

      // Calculate current metrics
      const skillsByCategory = user.skills.reduce((acc, skill) => {
        acc[skill.category] = (acc[skill.category] || 0) + 1;
        return acc;
      }, {} as Record<SkillCategory, number>);

      const averageLevel = this.calculateAverageSkillLevel(user.skills);
      const completedCertifications = user.skills.reduce(
        (sum, skill) => sum + skill.certifications.length, 
        0
      );

      // Get historical progress data
      const progressMetrics = await this.getProgressMetrics(userId);

      const analytics: SkillsAnalytics = {
        totalSkills: user.skills.length,
        skillsByCategory,
        averageLevel,
        completedCertifications,
        learningHours: await this.calculateLearningHours(userId),
        progressMetrics
      };

      this.logger.info('Generated skills analytics', {
        userId,
        totalSkills: analytics.totalSkills,
        averageLevel: analytics.averageLevel
      });

      return {
        success: true,
        data: analytics
      };
    } catch (error) {
      this.logger.error('Failed to get skills analytics', {
        error: error instanceof Error ? error.message : error,
        userId
      });
      throw error;
    }
  }

  /**
   * Search skills with advanced filtering and AI-powered suggestions
   */
  async searchSkills(
    query: string,
    options: {
      category?: SkillCategory;
      difficulty?: SkillLevel;
      limit?: number;
      skip?: number;
      includeAISuggestions?: boolean;
    } = {}
  ): Promise<ApiResponse<SkillDocument[]>> {
    try {
      const skills = await Skill.searchSkills(query, {
        limit: options.limit || 20,
        skip: options.skip || 0,
        category: options.category,
        difficulty: options.difficulty
      });

      let aiSuggestions: string[] = [];
      if (options.includeAISuggestions && skills.length < 5) {
        // Generate AI suggestions for better search results
        aiSuggestions = await this.generateSearchSuggestions(query);
      }

      const total = await Skill.countDocuments({
        isActive: true,
        $text: { $search: query },
        ...(options.category && { category: options.category }),
        ...(options.difficulty && { difficulty: options.difficulty })
      });

      const pagination: PaginationInfo = {
        page: Math.floor((options.skip || 0) / (options.limit || 20)) + 1,
        limit: options.limit || 20,
        total,
        totalPages: Math.ceil(total / (options.limit || 20)),
        hasNext: (options.skip || 0) + (options.limit || 20) < total,
        hasPrevious: (options.skip || 0) > 0
      };

      return {
        success: true,
        data: skills,
        pagination,
        metadata: {
          aiSuggestions: aiSuggestions.length > 0 ? aiSuggestions : undefined
        }
      };
    } catch (error) {
      this.logger.error('Failed to search skills', {
        error: error instanceof Error ? error.message : error,
        query,
        options
      });
      throw error;
    }
  }

  /**
   * Get trending skills based on market demand and user activity
   */
  async getTrendingSkills(limit = 10): Promise<ApiResponse<any[]>> {
    try {
      const cacheKey = 'trending_skills';
      const cached = await this.redisService.getJson(cacheKey);
      
      if (cached) {
        return {
          success: true,
          data: cached.slice(0, limit)
        };
      }

      const trendingSkills = await Skill.getTrendingSkills(limit * 2);
      
      // Enhance with additional metrics
      const enhancedSkills = await Promise.all(
        trendingSkills.map(async (skill) => {
          const userCount = await User.countDocuments({
            'skills.skillId': skill._id,
            status: 'active'
          });
          
          const learningPathCount = await LearningPath.countDocuments({
            skills: skill._id,
            isActive: true
          });

          return {
            ...skill,
            activeUsers: userCount,
            availablePaths: learningPathCount,
            trendScore: skill.trendingScore
          };
        })
      );

      // Cache for 4 hours
      await this.redisService.setJson(cacheKey, enhancedSkills, 14400);

      return {
        success: true,
        data: enhancedSkills.slice(0, limit)
      };
    } catch (error) {
      this.logger.error('Failed to get trending skills', {
        error: error instanceof Error ? error.message : error,
        limit
      });
      throw error;
    }
  }

  /**
   * Get team skills overview and recommendations
   */
  async getTeamSkillsOverview(teamId: string): Promise<ApiResponse<TeamSkillsOverview>> {
    try {
      // Get team members
      const teamMembers = await User.find({
        // Assuming team information is stored in user metadata
        'metadata.teamId': teamId,
        status: 'active'
      });

      if (teamMembers.length === 0) {
        throw ApiError.notFound('Team not found or has no members');
      }

      // Analyze skill coverage
      const skillCoverage = await this.analyzeTeamSkillCoverage(teamMembers);
      
      // Identify skill gaps
      const skillGaps = await this.identifyTeamSkillGaps(teamMembers, teamId);
      
      // Generate recommendations
      const recommendations = await this.generateTeamRecommendations(skillCoverage, skillGaps);

      const overview: TeamSkillsOverview = {
        teamId,
        totalMembers: teamMembers.length,
        skillCoverage,
        skillGaps,
        recommendations
      };

      this.logger.info('Generated team skills overview', {
        teamId,
        memberCount: teamMembers.length,
        skillsCovered: skillCoverage.length,
        gapsIdentified: skillGaps.length
      });

      return {
        success: true,
        data: overview
      };
    } catch (error) {
      this.logger.error('Failed to get team skills overview', {
        error: error instanceof Error ? error.message : error,
        teamId
      });
      throw error;
    }
  }

  /**
   * Update user skill level and track progress
   */
  async updateUserSkill(
    userId: string,
    skillId: string,
    updates: {
      level?: SkillLevel;
      endorsements?: number;
      certifications?: any[];
    }
  ): Promise<ApiResponse<UserDocument>> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found');
      }

      const skillIndex = user.skills.findIndex(s => s.skillId === skillId);
      if (skillIndex === -1) {
        throw ApiError.notFound('Skill not found in user profile');
      }

      const oldLevel = user.skills[skillIndex].level;
      
      // Update skill
      if (updates.level) {
        user.skills[skillIndex].level = updates.level;
      }
      if (updates.endorsements !== undefined) {
        user.skills[skillIndex].endorsements = updates.endorsements;
      }
      if (updates.certifications) {
        user.skills[skillIndex].certifications = updates.certifications;
      }
      
      user.skills[skillIndex].lastAssessed = new Date();
      
      await user.save();

      // Track progress analytics
      if (updates.level && updates.level !== oldLevel) {
        await this.analyticsService.trackEvent('skill_level_updated', {
          userId,
          skillId,
          oldLevel,
          newLevel: updates.level,
          levelUp: this.getSkillLevelValue(updates.level) > this.getSkillLevelValue(oldLevel)
        });
      }

      this.logger.info('Updated user skill', {
        userId,
        skillId,
        updates,
        levelChanged: updates.level !== oldLevel
      });

      return {
        success: true,
        data: user,
        message: 'Skill updated successfully'
      };
    } catch (error) {
      this.logger.error('Failed to update user skill', {
        error: error instanceof Error ? error.message : error,
        userId,
        skillId,
        updates
      });
      throw error;
    }
  }

  // Private helper methods

  private async getDataDrivenRecommendations(
    user: UserDocument,
    options: any
  ): Promise<any[]> {
    const userSkillIds = user.skills.map(s => s.skillId);
    
    return await Skill.getRecommendations(
      userSkillIds,
      {
        categories: options.categories,
        difficulty: options.difficulty,
        maxLearningHours: options.maxLearningHours
      },
      options.limit || 10
    );
  }

  private combineRecommendations(aiRecs: any[], dataRecs: any[]): any[] {
    const combined = new Map();
    
    // Add AI recommendations with higher weight
    aiRecs.forEach(rec => {
      combined.set(rec.skillId, {
        ...rec,
        score: rec.priority * 2,
        source: 'ai'
      });
    });
    
    // Add data recommendations
    dataRecs.forEach(rec => {
      if (combined.has(rec.id)) {
        const existing = combined.get(rec.id);
        existing.score += rec.demandScore || 5;
        existing.source = 'hybrid';
      } else {
        combined.set(rec.id, {
          skillId: rec.id,
          skillName: rec.name,
          category: rec.category,
          reasoning: `Popular skill in ${rec.category} category`,
          priority: rec.demandScore || 5,
          score: rec.demandScore || 5,
          source: 'data'
        });
      }
    });
    
    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score);
  }

  private async createSkillAssessment(
    userSkill: UserSkill,
    skill: SkillDocument,
    targetRole?: string
  ): Promise<SkillAssessment> {
    const targetLevel = await this.determineTargetLevel(skill, targetRole);
    const gapAnalysis = await this.analyzeSkillGap(userSkill, targetLevel);
    const resources = await this.getSkillResources(skill, userSkill.level, targetLevel);

    return {
      skillId: skill.id,
      currentLevel: userSkill.level,
      targetLevel,
      gapAnalysis,
      resources
    };
  }

  private async getCriticalSkillsForRole(targetRole?: string): Promise<SkillDocument[]> {
    if (!targetRole) {
      return await Skill.find({ 
        isActive: true, 
        demandScore: { $gte: 8 } 
      }).limit(10);
    }
    
    return await Skill.find({
      isActive: true,
      $or: [
        { tags: { $regex: targetRole, $options: 'i' } },
        { keywords: { $regex: targetRole, $options: 'i' } }
      ]
    }).limit(15);
  }

  private calculateSkillGap(current: SkillLevel, target: SkillLevel): number {
    const levels = {
      [SkillLevel.BEGINNER]: 1,
      [SkillLevel.INTERMEDIATE]: 2,
      [SkillLevel.ADVANCED]: 3,
      [SkillLevel.EXPERT]: 4
    };
    
    return levels[target] - levels[current];
  }

  private calculateAverageSkillLevel(skills: UserSkill[]): number {
    if (skills.length === 0) return 0;
    
    const totalLevel = skills.reduce((sum, skill) => {
      return sum + this.getSkillLevelValue(skill.level);
    }, 0);
    
    return totalLevel / skills.length;
  }

  private getSkillLevelValue(level: SkillLevel): number {
    const values = {
      [SkillLevel.BEGINNER]: 1,
      [SkillLevel.INTERMEDIATE]: 2,
      [SkillLevel.ADVANCED]: 3,
      [SkillLevel.EXPERT]: 4
    };
    return values[level] || 1;
  }

  private async getProgressMetrics(userId: string): Promise<any> {
    // This would typically query analytics data
    // For now, return mock data
    return {
      skillsGained: 3,
      levelsAdvanced: 5,
      certificationsEarned: 1,
      period: '30 days'
    };
  }

  private async calculateLearningHours(userId: string): Promise<number> {
    // This would integrate with learning tracking system
    return 45; // Mock data
  }

  private async generateSearchSuggestions(query: string): Promise<string[]> {
    // Use AI to generate related search terms
    try {
      const suggestions = await this.aiService.generateSkillRecommendations(
        {} as UserDocument, // Mock user for suggestions
        [],
        query,
        3
      );
      return suggestions.map(s => s.skillName);
    } catch {
      return [];
    }
  }

  private async analyzeTeamSkillCoverage(members: UserDocument[]): Promise<any[]> {
    const skillMap = new Map();
    
    members.forEach(member => {
      member.skills.forEach(skill => {
        const key = skill.skillId;
        if (!skillMap.has(key)) {
          skillMap.set(key, {
            skillId: key,
            skillName: skill.skillName,
            category: skill.category,
            members: [],
            levels: []
          });
        }
        
        const skillData = skillMap.get(key);
        skillData.members.push(member.id);
        skillData.levels.push(this.getSkillLevelValue(skill.level));
      });
    });
    
    return Array.from(skillMap.values()).map(skill => ({
      ...skill,
      membersWithSkill: skill.members.length,
      averageLevel: skill.levels.reduce((a: number, b: number) => a + b, 0) / skill.levels.length,
      expertCount: skill.levels.filter((level: number) => level >= 4).length
    }));
  }

  private async identifyTeamSkillGaps(members: UserDocument[], teamId: string): Promise<any[]> {
    // Identify critical skills missing from the team
    const criticalSkills = await Skill.find({ 
      demandScore: { $gte: 7 }, 
      isActive: true 
    });
    
    const teamSkills = new Set();
    members.forEach(member => {
      member.skills.forEach(skill => teamSkills.add(skill.skillId));
    });
    
    return criticalSkills
      .filter(skill => !teamSkills.has(skill.id))
      .map(skill => ({
        skillId: skill.id,
        skillName: skill.name,
        priority: skill.demandScore,
        recommendedMembers: members
          .filter(member => this.shouldLearnSkill(member, skill))
          .map(member => member.id)
          .slice(0, 3)
      }));
  }

  private shouldLearnSkill(member: UserDocument, skill: SkillDocument): boolean {
    // Logic to determine if a member should learn a particular skill
    const relatedSkills = member.skills.filter(s => s.category === skill.category);
    return relatedSkills.length > 0 && relatedSkills.length < 5;
  }

  private async generateTeamRecommendations(skillCoverage: any[], skillGaps: any[]): Promise<any[]> {
    const recommendations = [];
    
    // Training recommendations
    if (skillGaps.length > 5) {
      recommendations.push({
        type: 'train' as const,
        description: `Focus on training team members in ${skillGaps.slice(0, 3).map(g => g.skillName).join(', ')}`,
        priority: 8
      });
    }
    
    // Cross-training recommendations
    const expertSkills = skillCoverage.filter(s => s.expertCount === 1);
    if (expertSkills.length > 0) {
      recommendations.push({
        type: 'cross_train' as const,
        description: `Cross-train team members in ${expertSkills[0].skillName} to reduce single points of failure`,
        priority: 7
      });
    }
    
    // Hiring recommendations
    const criticalGaps = skillGaps.filter(g => g.priority >= 8 && g.recommendedMembers.length === 0);
    if (criticalGaps.length > 0) {
      recommendations.push({
        type: 'hire' as const,
        description: `Consider hiring for ${criticalGaps[0].skillName} expertise`,
        priority: 9
      });
    }
    
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private async determineTargetLevel(skill: SkillDocument, targetRole?: string): Promise<SkillLevel> {
    // Logic to determine appropriate target level based on skill and role
    if (!targetRole) return SkillLevel.INTERMEDIATE;
    
    if (targetRole.toLowerCase().includes('senior') || targetRole.toLowerCase().includes('lead')) {
      return SkillLevel.ADVANCED;
    }
    
    if (targetRole.toLowerCase().includes('architect') || targetRole.toLowerCase().includes('expert')) {
      return SkillLevel.EXPERT;
    }
    
    return SkillLevel.INTERMEDIATE;
  }

  private async analyzeSkillGap(userSkill: UserSkill, targetLevel: SkillLevel): Promise<any> {
    const gap = this.calculateSkillGap(userSkill.level, targetLevel);
    
    return {
      missingAreas: gap > 0 ? [`Advanced ${userSkill.skillName} concepts`] : [],
      recommendedActions: gap > 0 ? ['Complete advanced training', 'Gain practical experience'] : [],
      estimatedTime: gap * 20 // 20 hours per level
    };
  }

  private async getSkillResources(skill: SkillDocument, currentLevel: SkillLevel, targetLevel: SkillLevel): Promise<any[]> {
    return skill.resources
      .filter(resource => 
        resource.difficulty && 
        this.getSkillLevelValue(resource.difficulty) >= this.getSkillLevelValue(currentLevel) &&
        this.getSkillLevelValue(resource.difficulty) <= this.getSkillLevelValue(targetLevel)
      )
      .slice(0, 5);
  }
}

export default SkillsService;