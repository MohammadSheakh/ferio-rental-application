import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';

/**
 * RevenueCat Service
 * Handles RevenueCat API integration and webhook verification
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('REVENUECAT_API_KEY');
    this.webhookSecret = this.configService.get<string>('REVENUECAT_WEBHOOK_SECRET');

    if (!this.apiKey) {
      this.logger.warn('REVENUECAT_API_KEY is not configured');
    }

    if (!this.webhookSecret) {
      this.logger.warn('REVENUECAT_WEBHOOK_SECRET is not configured');
    }

    this.logger.log('✅ RevenueCat Service initialized');
  }

  /**
   * Verify RevenueCat webhook signature
   * RevenueCat signs webhooks with HMAC-SHA256
   *
   * @param body - Webhook request body
   * @param signature - X-RevenueCat-Signature header
   * @returns true if signature is valid
   */
  verifyWebhookSignature(body: any, signature: string): boolean {
    if (!this.webhookSecret) {
      this.logger.error('REVENUECAT_WEBHOOK_SECRET is not configured');
      return false;
    }

    if (!signature) {
      this.logger.error('No webhook signature provided');
      return false;
    }

    try {
      // Parse signature: "hash=<hex_encoded_hash>"
      const signatureParts = signature.split('=');
      if (signatureParts.length !== 2) {
        this.logger.error('Invalid signature format');
        return false;
      }

      const receivedHash = signatureParts[1];

      // Calculate expected hash
      const bodyString = JSON.stringify(body);
      const expectedHash = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(bodyString)
        .digest('hex');

      // Timing-safe comparison
      const isValid = crypto.timingSafeEqual(
        Buffer.from(receivedHash, 'hex'),
        Buffer.from(expectedHash, 'hex'),
      );

      this.logger.log(`Webhook signature verification: ${isValid ? '✅' : '❌'}`);
      return isValid;
    } catch (error) {
      this.logger.error(`Error verifying webhook signature: ${error.message}`);
      return false;
    }
  }

  /**
   * Get user subscriptions from RevenueCat
   *
   * @param revenueCatUserId - RevenueCat user ID
   * @returns User's subscription data
   */
  async getUserSubscriptions(revenueCatUserId: string): Promise<any> {
    this.logger.debug(`Getting subscriptions for RevenueCat user: ${revenueCatUserId}`);

    // Note: This would make an API call to RevenueCat
    // For now, this is a placeholder for future implementation

    this.logger.warn('getUserSubscriptions not yet implemented');
    return null;
  }

  /**
   * Validate RevenueCat receipt
   *
   * @param receiptData - Receipt data from Apple/Google
   * @returns Validation result
   */
  async validateReceipt(receiptData: string): Promise<any> {
    this.logger.debug('Validating RevenueCat receipt');

    // Note: This would make an API call to RevenueCat
    // For now, this is a placeholder

    this.logger.warn('validateReceipt not yet implemented');
    return null;
  }

  /**
   * Map RevenueCat product ID to subscription type
   *
   * @param productId - RevenueCat product ID
   * @returns Subscription type
   */
  mapProductIdToSubscriptionType(productId: string): string | null {
    const productMapping: Record<string, string> = {
      'individual_monthly': 'individual',
      'individual_annual': 'individual',
      'business_starter_monthly': 'business_starter',
      'business_level1_monthly': 'business_level1',
      'business_level2_monthly': 'business_level2',
    };

    return productMapping[productId] || null;
  }
}
