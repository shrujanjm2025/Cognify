import OpenAI from 'openai';
import { aiConfig } from '@config/index';
import { LoggerService } from './LoggerService';
import { RedisService } from './RedisService';
import { UserDocument } from '@models/User';
import { SkillDocument } from '@models/Skill';
import { SkillCategory, SkillLevel } from '@types/index';

export interface SkillRecommendation {
  skillId: string;
  skillName: string;
  category: SkillCategory;
  reasoning: string;
  priority: number;
  estimatedLearningTime: number;
  prerequisites: string[];
  resources: string[];
}

export interface CareerPathSuggestion {
  role: string;
  description: string;
  requiredSkills: string[];
  timeToAchieve: number;
  steps: string[];
  marketDemand: number;
}

export interface LearningPathRecommendation {
  pathId: string;
  title: string;
  reasoning: string;
  relevanceScore: number;
  estimatedDuration: number;
  skillsGained: string[];
}

export interface InterviewQuestion {
  question: string;
  category: string;
  difficulty: SkillLevel;
  expectedAnswer?: string;
  scoringCriteria: string[];
}

export interface InterviewAnalysis {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
}

export class AIService {
  private static instance: AIService;
  private openai: OpenAI;
  private readonly logger = LoggerService.getInstance();
  private readonly redisService = RedisService.getInstance();

  private constructor() {
    this.openai = new OpenAI({
      apiKey: aiConfig.openaiApiKey,
      timeout: aiConfig.requestTimeout,
      maxRetries: aiConfig.maxRetries,
    });
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Generate personalized skill recommendations based on user profile
   */
  async generateSkillRecommendations(
    user: UserDocument,
    availableSkills: SkillDocument[],
    targetRole?: string,
    limit = 5
  ): Promise<SkillRecommendation[]> {
    try {
      const cacheKey = `skill_recommendations:${user.id}:${targetRole || 'general'}`;
      const cached = await this.redisService.getJson<SkillRecommendation[]>(cacheKey);
      
      if (cached) {
        return cached.slice(0, limit);
      }

      const userSkills = user.skills.map(s => s.skillName).join(', ');
      const userRole = user.role;
      const userDepartment = user.department;

      const prompt = `
        As an AI career advisor for Cognizant, analyze the following user profile and recommend skills:
        
        User Profile:
        - Current Skills: ${userSkills}
        - Role: ${userRole}
        - Department: ${userDepartment}
        - Target Role: ${targetRole || 'Career advancement'}
        
        Available Skills: ${availableSkills.map(s => `${s.name} (${s.category}, ${s.difficulty})`).join(', ')}
        
        Please recommend the top ${limit * 2} most relevant skills for this user's career growth.
        Consider:
        1. Skills that complement their current expertise
        2. Industry trends and market demand
        3. Skills needed for their target role
        4. Logical learning progression
        
        Respond in JSON format with the following structure:
        {
          "recommendations": [
            {
              "skillName": "skill name",
              "category": "skill category",
              "reasoning": "why this skill is recommended",
              "priority": 1-10,
              "estimatedLearningTime": hours,
              "prerequisites": ["prerequisite skills"],
              "resources": ["suggested resource types"]
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert career advisor and skills development specialist for enterprise technology consulting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: aiConfig.maxTokens,
        temperature: aiConfig.temperature,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI service');
      }

      const aiResponse = JSON.parse(content);
      const recommendations: SkillRecommendation[] = aiResponse.recommendations
        .map((rec: any) => {
          const skill = availableSkills.find(s => 
            s.name.toLowerCase() === rec.skillName.toLowerCase()
          );
          
          if (!skill) return null;
          
          return {
            skillId: skill.id,
            skillName: skill.name,
            category: skill.category,
            reasoning: rec.reasoning,
            priority: rec.priority,
            estimatedLearningTime: rec.estimatedLearningTime,
            prerequisites: rec.prerequisites,
            resources: rec.resources
          };
        })
        .filter(Boolean)
        .slice(0, limit);

      // Cache for 24 hours
      await this.redisService.setJson(cacheKey, recommendations, 86400);

      this.logger.info('Generated skill recommendations', {
        userId: user.id,
        targetRole,
        recommendationCount: recommendations.length
      });

      return recommendations;
    } catch (error) {
      this.logger.error('Failed to generate skill recommendations', {
        error: error instanceof Error ? error.message : error,
        userId: user.id,
        targetRole
      });
      throw error;
    }
  }

  /**
   * Generate career path suggestions based on current skills
   */
  async generateCareerPathSuggestions(
    user: UserDocument,
    limit = 3
  ): Promise<CareerPathSuggestion[]> {
    try {
      const cacheKey = `career_paths:${user.id}`;
      const cached = await this.redisService.getJson<CareerPathSuggestion[]>(cacheKey);
      
      if (cached) {
        return cached.slice(0, limit);
      }

      const userSkills = user.skills.map(s => s.skillName).join(', ');
      const currentRole = user.role;
      const department = user.department;
      const experience = this.calculateExperience(user);

      const prompt = `
        As a career counselor at Cognizant, suggest potential career paths for this employee:
        
        Current Profile:
        - Skills: ${userSkills}
        - Current Role: ${currentRole}
        - Department: ${department}
        - Experience Level: ${experience}
        
        Please suggest ${limit} realistic career advancement paths within the next 2-5 years.
        Consider Cognizant's organizational structure and technology consulting focus.
        
        Respond in JSON format:
        {
          "careerPaths": [
            {
              "role": "target role title",
              "description": "role description and responsibilities",
              "requiredSkills": ["skill1", "skill2"],
              "timeToAchieve": months,
              "steps": ["step1", "step2"],
              "marketDemand": 1-10
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior career advisor at Cognizant Technology Solutions with deep knowledge of technology roles and career progression.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: aiConfig.maxTokens,
        temperature: aiConfig.temperature,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI service');
      }

      const aiResponse = JSON.parse(content);
      const suggestions: CareerPathSuggestion[] = aiResponse.careerPaths;

      // Cache for 7 days
      await this.redisService.setJson(cacheKey, suggestions, 604800);

      this.logger.info('Generated career path suggestions', {
        userId: user.id,
        suggestionCount: suggestions.length
      });

      return suggestions;
    } catch (error) {
      this.logger.error('Failed to generate career path suggestions', {
        error: error instanceof Error ? error.message : error,
        userId: user.id
      });
      throw error;
    }
  }

  /**
   * Generate interview questions for a specific role and skills
   */
  async generateInterviewQuestions(
    position: string,
    skills: string[],
    difficulty: SkillLevel = SkillLevel.INTERMEDIATE,
    count = 10
  ): Promise<InterviewQuestion[]> {
    try {
      const cacheKey = `interview_questions:${position}:${skills.join(',')}:${difficulty}`;
      const cached = await this.redisService.getJson<InterviewQuestion[]>(cacheKey);
      
      if (cached) {
        return cached.slice(0, count);
      }

      const prompt = `
        Generate ${count} interview questions for a ${position} position focusing on these skills: ${skills.join(', ')}.
        
        Requirements:
        - Difficulty level: ${difficulty}
        - Mix of technical, behavioral, and situational questions
        - Include expected answer guidelines and scoring criteria
        - Questions should be relevant to Cognizant's consulting environment
        
        Respond in JSON format:
        {
          "questions": [
            {
              "question": "interview question",
              "category": "technical|behavioral|situational",
              "difficulty": "${difficulty}",
              "expectedAnswer": "brief answer guideline",
              "scoringCriteria": ["criteria1", "criteria2"]
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are an experienced technical interviewer and hiring manager at Cognizant Technology Solutions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: aiConfig.maxTokens,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI service');
      }

      const aiResponse = JSON.parse(content);
      const questions: InterviewQuestion[] = aiResponse.questions;

      // Cache for 1 hour
      await this.redisService.setJson(cacheKey, questions, 3600);

      this.logger.info('Generated interview questions', {
        position,
        skills: skills.length,
        difficulty,
        questionCount: questions.length
      });

      return questions;
    } catch (error) {
      this.logger.error('Failed to generate interview questions', {
        error: error instanceof Error ? error.message : error,
        position,
        skills
      });
      throw error;
    }
  }

  /**
   * Analyze interview responses and provide feedback
   */
  async analyzeInterviewResponse(
    question: string,
    response: string,
    expectedCriteria: string[]
  ): Promise<InterviewAnalysis> {
    try {
      const prompt = `
        Analyze this interview response:
        
        Question: ${question}
        Response: ${response}
        Expected Criteria: ${expectedCriteria.join(', ')}
        
        Provide detailed analysis including:
        1. Overall score (0-100)
        2. Strengths demonstrated
        3. Areas for improvement
        4. Specific recommendations
        5. Technical competency score
        6. Communication effectiveness score
        7. Problem-solving approach score
        
        Respond in JSON format:
        {
          "overallScore": 0-100,
          "strengths": ["strength1", "strength2"],
          "weaknesses": ["weakness1", "weakness2"],
          "recommendations": ["recommendation1", "recommendation2"],
          "technicalScore": 0-100,
          "communicationScore": 0-100,
          "problemSolvingScore": 0-100
        }
      `;

      const response_ai = await this.openai.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert interview assessor with deep knowledge of technical and behavioral competencies.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: aiConfig.maxTokens,
        temperature: 0.3, // Lower temperature for more consistent scoring
      });

      const content = response_ai.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI service');
      }

      const analysis: InterviewAnalysis = JSON.parse(content);

      this.logger.info('Analyzed interview response', {
        overallScore: analysis.overallScore,
        technicalScore: analysis.technicalScore,
        communicationScore: analysis.communicationScore
      });

      return analysis;
    } catch (error) {
      this.logger.error('Failed to analyze interview response', {
        error: error instanceof Error ? error.message : error,
        question: question.substring(0, 100)
      });
      throw error;
    }
  }

  /**
   * Generate learning content recommendations
   */
  async generateLearningContent(
    skillName: string,
    userLevel: SkillLevel,
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading' = 'visual'
  ): Promise<{
    modules: Array<{
      title: string;
      description: string;
      type: string;
      duration: number;
      difficulty: SkillLevel;
    }>;
    resources: Array<{
      title: string;
      type: string;
      url?: string;
      description: string;
    }>;
  }> {
    try {
      const cacheKey = `learning_content:${skillName}:${userLevel}:${learningStyle}`;
      const cached = await this.redisService.getJson(cacheKey);
      
      if (cached) {
        return cached;
      }

      const prompt = `
        Create a comprehensive learning curriculum for "${skillName}" skill.
        
        Parameters:
        - Current user level: ${userLevel}
        - Preferred learning style: ${learningStyle}
        - Target: Enterprise/professional context
        
        Generate:
        1. 5-7 progressive learning modules
        2. Recommended resources for each module
        3. Appropriate content types based on learning style
        
        Respond in JSON format:
        {
          "modules": [
            {
              "title": "module title",
              "description": "what will be learned",
              "type": "video|interactive|reading|hands-on",
              "duration": minutes,
              "difficulty": "beginner|intermediate|advanced|expert"
            }
          ],
          "resources": [
            {
              "title": "resource title",
              "type": "video|article|course|tutorial|book",
              "url": "optional url",
              "description": "resource description"
            }
          ]
        }
      `;

      const response = await this.openai.chat.completions.create({
        model: aiConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert instructional designer and learning specialist focused on professional development.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: aiConfig.maxTokens,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI service');
      }

      const learningContent = JSON.parse(content);

      // Cache for 24 hours
      await this.redisService.setJson(cacheKey, learningContent, 86400);

      this.logger.info('Generated learning content', {
        skillName,
        userLevel,
        learningStyle,
        moduleCount: learningContent.modules.length
      });

      return learningContent;
    } catch (error) {
      this.logger.error('Failed to generate learning content', {
        error: error instanceof Error ? error.message : error,
        skillName,
        userLevel
      });
      throw error;
    }
  }

  /**
   * Calculate user experience level based on profile data
   */
  private calculateExperience(user: UserDocument): string {
    const accountAge = Date.now() - user.createdAt.getTime();
    const monthsActive = accountAge / (1000 * 60 * 60 * 24 * 30);
    const skillCount = user.skills.length;
    const totalPoints = user.totalPoints;

    if (monthsActive < 6 || skillCount < 3 || totalPoints < 100) {
      return 'Entry Level';
    } else if (monthsActive < 24 || skillCount < 8 || totalPoints < 500) {
      return 'Mid Level';
    } else if (monthsActive < 60 || skillCount < 15 || totalPoints < 1500) {
      return 'Senior Level';
    } else {
      return 'Expert Level';
    }
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'user',
            content: 'Hello, this is a health check. Please respond with "OK".'
          }
        ],
        max_tokens: 10,
        temperature: 0,
      });

      return response.choices[0]?.message?.content?.includes('OK') || false;
    } catch (error) {
      this.logger.error('AI service health check failed', {
        error: error instanceof Error ? error.message : error
      });
      return false;
    }
  }
}

export default AIService;