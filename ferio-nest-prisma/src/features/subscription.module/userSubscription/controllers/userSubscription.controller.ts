import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserSubscriptionService } from './services/userSubscription.service';
import { AuthGuard, RolesGuard, Roles, User } from '@app/common';
import { Throttle } from '@nestjs/throttler';
import { UserSubscriptionStatus } from './constants/userSubscription.constants';

/**
 * UserSubscription Controller
 * Handles user subscription operations
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Controller('subscriptions')
@ApiTags('User Subscriptions')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
export class UserSubscriptionController {
  constructor(
    private readonly userSubscriptionService: UserSubscriptionService,
  ) {}

  /**
   * Start free trial (7 days)
   */
  @Post('start-free-trial')
  @ApiOperation({
    summary: 'Start free trial',
    description: 'Start 7-day free trial with card collection',
  })
  @ApiResponse({ status: 200, description: 'Free trial started successfully' })
  @ApiResponse({ status: 400, description: 'User not eligible for free trial' })
  @Throttle(1, 3600) // 1 trial per hour
  async startFreeTrial(@User() user: any) {
    const result = await this.userSubscriptionService.startFreeTrial(user.userId);

    return {
      success: true,
      data: result,
      message: 'Free trial started successfully. Please complete payment setup.',
    };
  }

  /**
   * Purchase subscription
   */
  @Post('purchase/:planId')
  @ApiOperation({
    summary: 'Purchase subscription',
    description: 'Purchase a subscription plan',
  })
  @ApiResponse({ status: 200, description: 'Subscription purchase initiated' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Throttle(3, 300) // 3 purchases per 5 minutes
  async purchaseSubscription(
    @Param('planId') planId: string,
    @User() user: any,
  ) {
    const result = await this.userSubscriptionService.purchaseSubscription(
      planId,
      user.userId,
    );

    return {
      success: true,
      data: result,
      message: 'Subscription purchase initiated. Please complete payment.',
    };
  }

  /**
   * Get user's active subscription
   */
  @Get('active')
  @ApiOperation({
    summary: 'Get active subscription',
    description: 'Get user\'s currently active subscription',
  })
  @ApiResponse({ status: 200, description: 'Active subscription retrieved' })
  @Throttle(100, 60)
  async getActiveSubscription(@User() user: any) {
    const subscription = await this.userSubscriptionService.getActiveSubscription(
      user.userId,
    );

    return {
      success: true,
      data: subscription,
      message: 'Active subscription retrieved successfully',
    };
  }

  /**
   * Get subscription history
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get subscription history',
    description: 'Get user\'s subscription history',
  })
  @ApiResponse({ status: 200, description: 'Subscription history retrieved' })
  @Throttle(100, 60)
  async getSubscriptionHistory(@User() user: any) {
    const subscriptions = await this.userSubscriptionService.getSubscriptionHistory(
      user.userId,
    );

    return {
      success: true,
      data: subscriptions,
      message: 'Subscription history retrieved successfully',
    };
  }

  /**
   * Cancel subscription
   */
  @Put(':id/cancel')
  @ApiOperation({
    summary: 'Cancel subscription',
    description: 'Cancel user\'s subscription',
  })
  @ApiResponse({ status: 200, description: 'Subscription cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  @Throttle(5, 60)
  async cancelSubscription(@Param('id') id: string) {
    const result = await this.userSubscriptionService.cancelSubscription(id);

    return {
      success: true,
      data: result,
      message: 'Subscription cancelled successfully',
    };
  }

  /**
   * Update subscription status (Admin only)
   */
  @Put(':id/status')
  @ApiOperation({
    summary: 'Update subscription status',
    description: 'Update subscription status (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @Roles('admin')
  @Throttle(10, 60)
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: UserSubscriptionStatus,
  ) {
    const result = await this.userSubscriptionService.updateSubscriptionStatus(
      id,
      status,
    );

    return {
      success: true,
      data: result,
      message: 'Subscription status updated successfully',
    };
  }
}
