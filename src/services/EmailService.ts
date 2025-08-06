import nodemailer, { Transporter, SendMailOptions } from 'nodemailer';
import { emailConfig } from '@config/index';
import { LoggerService } from './LoggerService';

export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: Transporter;
  private readonly logger = LoggerService.getInstance();

  private constructor() {
    this.transporter = this.createTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private createTransporter(): Transporter {
    return nodemailer.createTransporter({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: {
        user: emailConfig.smtp.auth.user,
        pass: emailConfig.smtp.auth.pass,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      let { html, text, subject } = options;

      // If template is specified, render it
      if (options.template && options.templateData) {
        const template = this.getTemplate(options.template, options.templateData);
        html = template.html;
        text = template.text || text;
        subject = template.subject;
      }

      const mailOptions: SendMailOptions = {
        from: {
          name: emailConfig.from.name,
          address: emailConfig.from.address,
        },
        to: options.to,
        subject,
        html,
        text,
        attachments: options.attachments,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      this.logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: options.to,
        subject,
        template: options.template,
      });
    } catch (error) {
      this.logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : error,
        to: options.to,
        subject: options.subject,
        template: options.template,
      });
      throw error;
    }
  }

  async sendVerificationEmail(email: string, firstName: string, token: string): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'verification',
      templateData: {
        firstName,
        verificationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`,
        supportEmail: emailConfig.from.address,
      },
    });
  }

  async sendPasswordResetEmail(email: string, firstName: string, token: string): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'password-reset',
      templateData: {
        firstName,
        resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`,
        supportEmail: emailConfig.from.address,
        expiryHours: 1,
      },
    });
  }

  async sendWelcomeEmail(email: string, firstName: string): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'welcome',
      templateData: {
        firstName,
        platformUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
        supportEmail: emailConfig.from.address,
      },
    });
  }

  async sendRecognitionNotification(
    email: string,
    recipientName: string,
    senderName: string,
    recognitionType: string,
    message: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'recognition',
      templateData: {
        recipientName,
        senderName,
        recognitionType,
        message,
        viewUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/recognition`,
      },
    });
  }

  async sendInterviewInvitation(
    email: string,
    candidateName: string,
    position: string,
    scheduledDate: Date,
    interviewUrl: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'interview-invitation',
      templateData: {
        candidateName,
        position,
        scheduledDate: scheduledDate.toLocaleString(),
        interviewUrl,
        supportEmail: emailConfig.from.address,
      },
    });
  }

  async sendInterviewReminder(
    email: string,
    candidateName: string,
    position: string,
    scheduledDate: Date,
    interviewUrl: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'interview-reminder',
      templateData: {
        candidateName,
        position,
        scheduledDate: scheduledDate.toLocaleString(),
        interviewUrl,
        supportEmail: emailConfig.from.address,
      },
    });
  }

  async sendLearningPathRecommendation(
    email: string,
    userName: string,
    learningPaths: Array<{ title: string; description: string; url: string }>
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'learning-recommendation',
      templateData: {
        userName,
        learningPaths,
        platformUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      },
    });
  }

  async sendMentorMatchNotification(
    email: string,
    menteeName: string,
    mentorName: string,
    matchReason: string
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      template: 'mentor-match',
      templateData: {
        menteeName,
        mentorName,
        matchReason,
        platformUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      },
    });
  }

  private getTemplate(templateName: string, data: Record<string, unknown>): EmailTemplate {
    // In a real implementation, you would load templates from files or a template service
    // For now, we'll return inline templates
    switch (templateName) {
      case 'verification':
        return {
          subject: 'Verify your email - Cognizant Talent Hub',
          html: this.renderVerificationTemplate(data),
          text: `Hi ${data.firstName}, please verify your email by clicking the link: ${data.verificationUrl}`,
        };

      case 'password-reset':
        return {
          subject: 'Reset your password - Cognizant Talent Hub',
          html: this.renderPasswordResetTemplate(data),
          text: `Hi ${data.firstName}, click the link to reset your password: ${data.resetUrl}`,
        };

      case 'welcome':
        return {
          subject: 'Welcome to Cognizant Talent Hub!',
          html: this.renderWelcomeTemplate(data),
          text: `Welcome to Cognizant Talent Hub, ${data.firstName}!`,
        };

      case 'recognition':
        return {
          subject: `You received recognition from ${data.senderName}!`,
          html: this.renderRecognitionTemplate(data),
          text: `${data.senderName} recognized you for ${data.recognitionType}: ${data.message}`,
        };

      case 'interview-invitation':
        return {
          subject: `Interview Invitation - ${data.position}`,
          html: this.renderInterviewInvitationTemplate(data),
          text: `You're invited for an interview for ${data.position} on ${data.scheduledDate}`,
        };

      case 'interview-reminder':
        return {
          subject: `Interview Reminder - ${data.position}`,
          html: this.renderInterviewReminderTemplate(data),
          text: `Reminder: Your interview for ${data.position} is scheduled for ${data.scheduledDate}`,
        };

      case 'learning-recommendation':
        return {
          subject: 'New Learning Recommendations for You!',
          html: this.renderLearningRecommendationTemplate(data),
          text: `Hi ${data.userName}, we have new learning recommendations for you!`,
        };

      case 'mentor-match':
        return {
          subject: 'You\'ve been matched with a mentor!',
          html: this.renderMentorMatchTemplate(data),
          text: `Great news! You've been matched with ${data.mentorName} as your mentor.`,
        };

      default:
        throw new Error(`Unknown email template: ${templateName}`);
    }
  }

  private renderVerificationTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Verify Your Email</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Cognizant Talent Hub</h1>
              </div>
              <div class="content">
                  <h2>Hi ${data.firstName},</h2>
                  <p>Welcome to Cognizant Talent & Engagement Hub! Please verify your email address to get started.</p>
                  <p>Click the button below to verify your email:</p>
                  <a href="${data.verificationUrl}" class="button">Verify Email</a>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="word-break: break-all;">${data.verificationUrl}</p>
                  <p>This link will expire in 24 hours for security reasons.</p>
              </div>
              <div class="footer">
                  <p>If you didn't create an account, please ignore this email.</p>
                  <p>Need help? Contact us at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private renderPasswordResetTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #dc2626; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Cognizant Talent Hub</h1>
              </div>
              <div class="content">
                  <h2>Hi ${data.firstName},</h2>
                  <p>We received a request to reset your password for your Cognizant Talent Hub account.</p>
                  <p>Click the button below to reset your password:</p>
                  <a href="${data.resetUrl}" class="button">Reset Password</a>
                  <p>If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="word-break: break-all;">${data.resetUrl}</p>
                  <p>This link will expire in ${data.expiryHours} hour(s) for security reasons.</p>
                  <p><strong>If you didn't request a password reset, please ignore this email and your password will remain unchanged.</strong></p>
              </div>
              <div class="footer">
                  <p>Need help? Contact us at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private renderWelcomeTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Welcome to Cognizant Talent Hub</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .button { display: inline-block; padding: 12px 30px; background: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .features { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Welcome to Cognizant Talent Hub!</h1>
              </div>
              <div class="content">
                  <h2>Hi ${data.firstName},</h2>
                  <p>Welcome to Cognizant Talent & Engagement Hub! We're excited to have you on board.</p>
                  <div class="features">
                      <h3>What you can do:</h3>
                      <ul>
                          <li>📚 Discover personalized learning paths</li>
                          <li>🏆 Give and receive peer recognition</li>
                          <li>🎯 Practice with AI-powered interviews</li>
                          <li>📅 Track deployment and milestone events</li>
                          <li>👥 Connect with mentors and teammates</li>
                          <li>📊 Monitor your progress and achievements</li>
                      </ul>
                  </div>
                  <p>Ready to get started?</p>
                  <a href="${data.platformUrl}" class="button">Explore the Platform</a>
              </div>
              <div class="footer">
                  <p>Need help getting started? Contact us at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private renderRecognitionTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>You Received Recognition!</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .recognition-card { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🏆 Recognition Received!</h1>
              </div>
              <div class="content">
                  <h2>Congratulations, ${data.recipientName}!</h2>
                  <p>You've received recognition from <strong>${data.senderName}</strong>!</p>
                  <div class="recognition-card">
                      <h3>Recognition Type: ${data.recognitionType}</h3>
                      <p><em>"${data.message}"</em></p>
                  </div>
                  <p>Your hard work and dedication are truly appreciated. Keep up the excellent work!</p>
                  <a href="${data.viewUrl}" class="button">View Recognition</a>
              </div>
              <div class="footer">
                  <p>Share your achievements and recognize your colleagues too!</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private renderInterviewInvitationTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Interview Invitation</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #6366f1; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .interview-details { background: #ede9fe; padding: 20px; border-radius: 5px; margin: 20px 0; }
              .button { display: inline-block; padding: 12px 30px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>Interview Invitation</h1>
              </div>
              <div class="content">
                  <h2>Hi ${data.candidateName},</h2>
                  <p>You're invited for an interview with Cognizant!</p>
                  <div class="interview-details">
                      <h3>Interview Details:</h3>
                      <p><strong>Position:</strong> ${data.position}</p>
                      <p><strong>Date & Time:</strong> ${data.scheduledDate}</p>
                      <p><strong>Type:</strong> AI-Powered Interview</p>
                  </div>
                  <p>Please prepare for the interview and join at the scheduled time.</p>
                  <a href="${data.interviewUrl}" class="button">Join Interview</a>
                  <p><strong>Tips for success:</strong></p>
                  <ul>
                      <li>Test your microphone and camera beforehand</li>
                      <li>Ensure stable internet connection</li>
                      <li>Prepare examples of your work and achievements</li>
                      <li>Review the job description and requirements</li>
                  </ul>
              </div>
              <div class="footer">
                  <p>Questions? Contact us at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private renderInterviewReminderTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Interview Reminder</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #f59e0b; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .reminder-box { background: #fef3c7; border: 2px solid #f59e0b; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
              .button { display: inline-block; padding: 12px 30px; background: #f59e0b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>⏰ Interview Reminder</h1>
              </div>
              <div class="content">
                  <h2>Hi ${data.candidateName},</h2>
                  <p>This is a friendly reminder about your upcoming interview.</p>
                  <div class="reminder-box">
                      <h3>Your interview is scheduled for:</h3>
                      <p><strong>${data.scheduledDate}</strong></p>
                      <p>Position: <strong>${data.position}</strong></p>
                  </div>
                  <p>Make sure you're ready to join on time!</p>
                  <a href="${data.interviewUrl}" class="button">Join Interview</a>
                  <p><strong>Last-minute checklist:</strong></p>
                  <ul>
                      <li>✅ Camera and microphone working</li>
                      <li>✅ Stable internet connection</li>
                      <li>✅ Quiet, well-lit environment</li>
                      <li>✅ Resume and examples ready</li>
                  </ul>
              </div>
              <div class="footer">
                  <p>Need help? Contact us at <a href="mailto:${data.supportEmail}">${data.supportEmail}</a></p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private renderLearningRecommendationTemplate(data: Record<string, unknown>): string {
    const learningPaths = data.learningPaths as Array<{ title: string; description: string; url: string }>;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Learning Recommendations</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #16a34a; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .learning-path { background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 15px 0; border-radius: 5px; }
              .button { display: inline-block; padding: 8px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 3px; font-size: 14px; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>📚 New Learning Recommendations</h1>
              </div>
              <div class="content">
                  <h2>Hi ${data.userName},</h2>
                  <p>Based on your skills and career goals, we've curated these learning paths for you:</p>
                  ${learningPaths.map(path => `
                      <div class="learning-path">
                          <h3>${path.title}</h3>
                          <p>${path.description}</p>
                          <a href="${path.url}" class="button">Start Learning</a>
                      </div>
                  `).join('')}
                  <p>Start your learning journey today and unlock new opportunities!</p>
              </div>
              <div class="footer">
                  <p>Visit your <a href="${data.platformUrl}/dashboard">dashboard</a> for more personalized recommendations.</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  private renderMentorMatchTemplate(data: Record<string, unknown>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <title>Mentor Match</title>
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; }
              .content { padding: 30px 20px; }
              .match-card { background: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 20px; margin: 20px 0; border-radius: 5px; }
              .button { display: inline-block; padding: 12px 30px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🤝 Mentor Match Found!</h1>
              </div>
              <div class="content">
                  <h2>Great news, ${data.menteeName}!</h2>
                  <p>We've found a perfect mentor match for you!</p>
                  <div class="match-card">
                      <h3>Your Mentor: ${data.mentorName}</h3>
                      <p><strong>Why this match:</strong> ${data.matchReason}</p>
                  </div>
                  <p>Your mentor is excited to help you grow and achieve your career goals. Connect with them to start your mentoring journey!</p>
                  <a href="${data.platformUrl}/mentoring" class="button">Connect with Mentor</a>
                  <p><strong>Next steps:</strong></p>
                  <ul>
                      <li>Schedule your first mentoring session</li>
                      <li>Prepare your goals and questions</li>
                      <li>Be open to feedback and guidance</li>
                      <li>Make the most of this valuable opportunity</li>
                  </ul>
              </div>
              <div class="footer">
                  <p>Make the most of your mentoring relationship!</p>
              </div>
          </div>
      </body>
      </html>
    `;
  }

  // Health check
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error('Email service connection failed', {
        error: error instanceof Error ? error.message : error,
      });
      return false;
    }
  }
}

export default EmailService;