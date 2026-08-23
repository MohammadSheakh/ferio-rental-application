import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionPlanService } from './services/subscriptionPlan.service';
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from './dto/subscriptionPlan.dto';
import { AuthGuard, RolesGuard, Roles } from '@app/common';
import { Throttle } from '@nestjs/throttler';

/**
 * SubscriptionPlan Controller
 * Handles subscription plan management (Admin only)
 *
 * @version 1.0.0 (NestJS Migration)
 * @author Senior Engineering Team
 */
@Controller('subscription-plans')
@ApiTags('Subscription Plans')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
export class SubscriptionPlanController {
  constructor(
    private readonly subscriptionPlanService: SubscriptionPlanService,
  ) {}

  /**
   * Get all active subscription plans
   */
  @Get()
  @ApiOperation({
    summary: 'Get all active plans',
    description: 'Get all active subscription plans available for purchase',
  })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  @Throttle(100, 60)
  async getAllActivePlans() {
    const plans = await this.subscriptionPlanService.findActivePlans();

    return {
      success: true,
      data: plans,
      message: 'Active subscription plans retrieved successfully',
    };
  }

  /**
   * Get plan by subscription type
   */
  @Get('type/:type')
  @ApiOperation({
    summary: 'Get plan by type',
    description: 'Get active subscription plan by subscription type',
  })
  @ApiResponse({ status: 200, description: 'Plan retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Throttle(100, 60)
  async getByType(@Param('type') type: string) {
    const plan = await this.subscriptionPlanService.getBySubscriptionType(type as any);

    if (!plan) {
      return {
        success: false,
        message: 'Subscription plan not found',
      };
    }

    return {
      success: true,
      data: plan,
      message: 'Subscription plan retrieved successfully',
    };
  }

  /**
   * Create subscription plan (Admin only)
   */
  @Post()
  @ApiOperation({
    summary: 'Create subscription plan',
    description: 'Create a new subscription plan (Admin only)',
  })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  @Roles('admin')
  @Throttle(10, 60)
  async create(@Body() createDto: CreateSubscriptionPlanDto) {
    const result = await this.subscriptionPlanService.createSubscriptionPlan(createDto);

    return {
      success: true,
      data: result.plan,
      metadata: result.metadata,
      message: 'Subscription plan created successfully',
    };
  }

  /**
   * Update subscription plan (Admin only)
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Update subscription plan',
    description: 'Update an existing subscription plan (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Roles('admin')
  @Throttle(10, 60)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSubscriptionPlanDto,
  ) {
    const plan = await this.subscriptionPlanService.updateSubscriptionPlan(id, updateDto);

    return {
      success: true,
      data: plan,
      message: 'Subscription plan updated successfully',
    };
  }

  /**
   * Delete subscription plan (Admin only)
   */
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete subscription plan',
    description: 'Soft delete a subscription plan (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @Roles('admin')
  @Throttle(5, 60)
  async delete(@Param('id') id: string) {
    const plan = await this.subscriptionPlanService.deleteSubscriptionPlan(id);

    return {
      success: true,
      data: plan,
      message: 'Subscription plan deleted successfully',
    };
  }
}
