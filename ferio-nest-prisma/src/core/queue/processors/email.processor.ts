import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { StructuredLogger } from '@app/common';
import { QUEUE_NAMES } from '../bullmq.constants';
import { EmailService } from '../../../features/authentication/email/email.service';

/**
 * Email Processor
 *
 * 📧 BULLMQ WORKER FOR ASYNC EMAIL PROCESSING
 *
 * Updated to use WorkerHost (compatible with @nestjs/bullmq v11)
 */
@Processor(QUEUE_NAMES.EMAIL)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new StructuredLogger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log('email_job_started', { jobId: job.id, jobName: job.name });

    try {
      switch (job.name) {
        case 'send-otp-email':
          return await this.emailService.sendOtpEmailNow(
            job.data.email,
            job.data.otp,
            job.data.type,
          );
        case 'send-welcome-email':
          return await this.emailService.sendWelcomeEmailNow(
            job.data.email,
            job.data.name,
          );
        case 'send-password-reset-confirmation':
          return await this.emailService.sendPasswordResetConfirmationNow(
            job.data.email,
          );
        case 'send-staff-access-email':
          return await this.emailService.sendStaffAccessEmailNow(
            job.data.email,
            job.data.token,
            job.data.purpose,
          );
        case 'send-task-notification':
          this.logger.warn('email_job_not_implemented', { jobName: job.name });
          return undefined;
        default:
          this.logger.warn('email_job_unknown', { jobName: job.name });
      }
    } catch (err: unknown) {
      this.logger.error('email_job_failed', {
        jobId: job.id,
        jobName: job.name,
        errorName: err instanceof Error ? err.name : 'UnknownError',
      });
      throw err;
    }
  }
}
