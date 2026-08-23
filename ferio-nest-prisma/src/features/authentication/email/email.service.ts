import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@app/queue';
import { StructuredLogger } from '@app/common';

/**
 * Email Service
 *
 * 📧 EMAIL SENDING SERVICE
 *
 * Handles all email sending operations:
 * - OTP verification emails
 * - Password reset emails
 * - Welcome emails
 * - Notification emails
 *
 * Production Ready:
 * - Integrate with SendGrid, AWS SES, or Nodemailer
 * - Queue emails via BullMQ for async processing
 * - Track email delivery and open rates
 *
 * Current Implementation:
 * - Emits recipient-free structured delivery diagnostics
 * - Ready for production integration
 */
@Injectable()
export class EmailService {
  private readonly logger = new StructuredLogger(EmailService.name);

  constructor(@InjectQueue(QUEUE_NAMES.EMAIL) private emailQueue: Queue) {}

  /**
   * Send OTP Email (Queued)
   *
   * @param email - Recipient email address
   * @param otp - OTP code
   * @param type - OTP type (verify or reset)
   */
  async sendOtpEmail(
    email: string,
    otp: string,
    type: 'verify' | 'reset',
  ): Promise<void> {
    await this.emailQueue.add('send-otp-email', { email, otp, type });
    this.logger.log('authentication_email_queued', {
      template: 'OTP',
      purpose: type,
    });
  }

  /**
   * Send OTP Email Now
   */
  async sendOtpEmailNow(
    email: string,
    otp: string,
    type: 'verify' | 'reset',
  ): Promise<void> {
    this.logger.log('authentication_email_delivery_simulated', {
      template: 'OTP',
      purpose: type,
    });

    // Production: Integrate with email provider
    // await this.sendEmail({
    //   to: email,
    //   subject,
    //   html: this.getOtpEmailTemplate(otp, type),
    // });
  }

  /**
   * Send Welcome Email (Queued)
   *
   * @param email - Recipient email address
   * @param name - User name
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.emailQueue.add('send-welcome-email', { email, name });
    this.logger.log('authentication_email_queued', { template: 'WELCOME' });
  }

  /**
   * Send Welcome Email Now
   */
  async sendWelcomeEmailNow(email: string, name: string): Promise<void> {
    this.logger.log('authentication_email_delivery_simulated', {
      template: 'WELCOME',
    });

    // Production: Send actual email
    // await this.sendEmail({
    //   to: email,
    //   subject: 'Welcome to Task Management!',
    //   html: this.getWelcomeEmailTemplate(name),
    // });
  }

  /**
   * Send Password Reset Confirmation (Queued)
   *
   * @param email - Recipient email address
   */
  async sendPasswordResetConfirmation(email: string): Promise<void> {
    await this.emailQueue.add('send-password-reset-confirmation', { email });
    this.logger.log('authentication_email_queued', {
      template: 'PASSWORD_RESET_CONFIRMATION',
    });
  }

  /**
   * Send Password Reset Confirmation Now
   */
  async sendPasswordResetConfirmationNow(email: string): Promise<void> {
    this.logger.log('authentication_email_delivery_simulated', {
      template: 'PASSWORD_RESET_CONFIRMATION',
    });

    // Production: Send actual email
    // await this.sendEmail({
    //   to: email,
    //   subject: 'Password Reset Successful',
    //   html: this.getPasswordResetConfirmationTemplate(),
    // });
  }

  async sendStaffAccessEmail(
    email: string,
    token: string,
    purpose: 'INVITE' | 'RESET',
  ): Promise<void> {
    await this.emailQueue.add('send-staff-access-email', {
      email,
      token,
      purpose,
    });
    this.logger.log('staff_access_email_queued', { purpose });
  }

  async sendStaffAccessEmailNow(
    email: string,
    token: string,
    purpose: 'INVITE' | 'RESET',
  ): Promise<void> {
    const adminWebUrl = process.env.ADMIN_WEB_URL ?? 'http://localhost:3001';
    const accessUrl = new URL('/staff-access', adminWebUrl);
    accessUrl.hash = new URLSearchParams({
      purpose: purpose.toLowerCase(),
      token,
    }).toString();
    this.logger.log('authentication_email_delivery_simulated', {
      template: 'STAFF_ACCESS',
      purpose,
    });

    // Production provider integration should send accessUrl.toString() to email.
    void email;
    void accessUrl;
  }

  /**
   * Generic Send Email Method
   *
   * Production implementation with SendGrid/AWS SES
   *
   * @param options - Email options
   */
  private async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    // Production: Implement with your email provider
    // Example with SendGrid:
    // const msg = {
    //   to: options.to,
    //   from: process.env.EMAIL_FROM,
    //   subject: options.subject,
    //   html: options.html,
    //   text: options.text,
    // };
    // await sgMail.send(msg);

    this.logger.log('authentication_email_delivery_simulated', {
      template: 'GENERIC',
      subject: options.subject,
    });
  }

  /**
   * OTP Email Template
   */
  private getOtpEmailTemplate(otp: string, type: 'verify' | 'reset'): string {
    const title =
      type === 'verify' ? 'Verify Your Email' : 'Reset Your Password';

    const description =
      type === 'verify'
        ? 'Thank you for registering! Please use the following OTP to verify your email address.'
        : 'You requested a password reset. Please use the following OTP to reset your password.';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .otp { font-size: 32px; font-weight: bold; color: #4F46E5; text-align: center; padding: 20px; background: white; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${title}</h1>
            </div>
            <div class="content">
              <p>${description}</p>
              <div class="otp">${otp}</div>
              <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>
              <p>If you didn't request this, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Task Management. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Welcome Email Template
   */
  private getWelcomeEmailTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to Task Management!</h1>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>We're excited to have you on board! Start managing your tasks efficiently and boost your productivity.</p>
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard" class="button">Go to Dashboard</a>
              <p>Here's what you can do:</p>
              <ul>
                <li>✅ Create and organize tasks</li>
                <li>✅ Set priorities and due dates</li>
                <li>✅ Track your progress</li>
                <li>✅ Collaborate with your team</li>
              </ul>
            </div>
            <div class="footer">
              <p>&copy; 2026 Task Management. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Password Reset Confirmation Template
   */
  private getPasswordResetConfirmationTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10B981; color: white; padding: 30px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Successful</h1>
            </div>
            <div class="content">
              <p>Your password has been successfully reset.</p>
              <p>If you didn't request this change, please contact our support team immediately.</p>
              <p>For security reasons, please use a strong password and don't share it with anyone.</p>
            </div>
            <div class="footer">
              <p>&copy; 2026 Task Management. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}
