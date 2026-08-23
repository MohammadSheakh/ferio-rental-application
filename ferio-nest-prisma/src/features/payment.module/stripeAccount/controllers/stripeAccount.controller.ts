import {
  Controller,
  Get,
  Post,
  Param,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StripeAccountService } from './services/stripeAccount.service';


import { AuthGuard, User } from '@app/common';

/**
 * StripeAccount Controller
 * Handles Stripe Connect onboarding operations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Controller('stripe-accounts')
@ApiTags('Stripe Accounts')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
export class StripeAccountController {
  constructor(private readonly stripeAccountService: StripeAccountService) {}

  /**
   * Create connected Stripe account
   * Initiates onboarding flow
   */
  @Post('connect')
  @ApiOperation({
    summary: 'Create Stripe account',
    description: 'Create a Stripe Connect account and get onboarding URL',
  })
  @ApiResponse({ status: 200, description: 'Account created successfully' })
  async createStripeAccount(
    @User() user: any,
    @Req() req: Request,
  ) {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol;

    const result = await this.stripeAccountService.createConnectedStripeAccount(
      user,
      host,
      protocol,
    );

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Success page for account onboarding
   * Called by Stripe after user completes onboarding
   */
  @Get('success/:id')
  @ApiOperation({
    summary: 'Success page',
    description: 'Handle successful Stripe account onboarding',
  })
  async successPage(
    @Param('id') id: string,
    @Req() req: Req,
    @Res() res: Res,
  ) {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol;

    try {
      // Get account details from Stripe
      const account = await (this.stripeAccountService as any).stripe.accounts.retrieve(id);

      // Check if account needs more information
      if (
        account?.requirements?.disabled_reason &&
        account.requirements.disabled_reason.indexOf('rejected') > -1
      ) {
        return res.redirect(
          `${protocol}://${host}/api/v1/stripe-accounts/refresh/${id}`,
        );
      }

      if (
        account?.requirements?.currently_due &&
        account.requirements.currently_due.length > 0
      ) {
        return res.redirect(
          `${protocol}://${host}/api/v1/stripe-accounts/refresh/${id}`,
        );
      }

      if (!account.payouts_enabled || !account.charges_enabled) {
        return res.redirect(
          `${protocol}://${host}/api/v1/stripe-accounts/refresh/${id}`,
        );
      }

      // Mark account as completed
      await this.stripeAccountService.onConnectedStripeAccountSuccess(id);

      // Render success page (in production, redirect to frontend)
      return res.send(`
        <html>
          <head><title>Stripe Account Connected</title></head>
          <body>
            <h1>✅ Stripe Account Connected Successfully!</h1>
            <p>Your Stripe account has been connected successfully.</p>
            <p>You can now accept payments.</p>
          </body>
        </html>
      `);
    } catch (error) {
      return res.status(500).send(`Error: ${error.message}`);
    }
  }

  /**
   * Refresh account connect link
   */
  @Get('refresh/:id')
  @ApiOperation({
    summary: 'Refresh onboarding',
    description: 'Get a new onboarding link for incomplete accounts',
  })
  async refreshAccountConnect(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol;

    const url = await this.stripeAccountService.refreshAccountConnect(
      id,
      host,
      protocol,
    );

    return {
      success: true,
      url,
    };
  }

  /**
   * Get user's Stripe account status
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get account status',
    description: 'Check if user has completed Stripe onboarding',
  })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully' })
  async getAccountStatus(@User() user: any) {
    const account = await this.stripeAccountService.findByUserId(user.userId);

    if (!account) {
      return {
        success: true,
        data: {
          hasAccount: false,
          isCompleted: false,
        },
      };
    }

    return {
      success: true,
      data: {
        hasAccount: true,
        isCompleted: account.isCompleted,
        accountId: account.accountId,
        createdAt: account.createdAt,
      },
    };
  }
}
