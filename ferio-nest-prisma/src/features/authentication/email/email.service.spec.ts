import { EmailService } from './email.service';

describe('EmailService secret-safe diagnostics', () => {
  it('queues required delivery data without logging recipient or OTP values', async () => {
    const queue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };
    const service = new EmailService(queue as never);
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    (service as unknown as { logger: typeof logger }).logger = logger;

    await service.sendOtpEmail(
      'private-customer@example.com',
      '654321',
      'verify',
    );

    expect(queue.add).toHaveBeenCalledWith('send-otp-email', {
      email: 'private-customer@example.com',
      otp: '654321',
      type: 'verify',
    });
    expect(logger.log).toHaveBeenCalledWith('authentication_email_queued', {
      template: 'OTP',
      purpose: 'verify',
    });
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(
      'private-customer@example.com',
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain('654321');
  });

  it('does not log recipient or OTP values in simulated delivery', async () => {
    const service = new EmailService({ add: jest.fn() } as never);
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    (service as unknown as { logger: typeof logger }).logger = logger;

    await service.sendOtpEmailNow(
      'private-customer@example.com',
      '654321',
      'reset',
    );

    expect(logger.log).toHaveBeenCalledWith(
      'authentication_email_delivery_simulated',
      { template: 'OTP', purpose: 'reset' },
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(
      'private-customer@example.com',
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain('654321');
  });

  it('builds staff setup delivery without logging the recipient or token', async () => {
    const service = new EmailService({ add: jest.fn() } as never);
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    (service as unknown as { logger: typeof logger }).logger = logger;

    await service.sendStaffAccessEmailNow(
      'private-agent@example.com',
      'private-setup-token',
      'INVITE',
    );

    expect(logger.log).toHaveBeenCalledWith(
      'authentication_email_delivery_simulated',
      { template: 'STAFF_ACCESS', purpose: 'INVITE' },
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(
      'private-agent@example.com',
    );
    expect(JSON.stringify(logger.log.mock.calls)).not.toContain(
      'private-setup-token',
    );
  });
});
