import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RentalSubscriptionsService } from '../services/rental-subscriptions.service';
import { CreateSubscriptionPlanDto, SubscribeOrganizationDto } from '../dto/rental-subscriptions.dto';
import { AuthGuard } from '@app/common';

@ApiTags('Rental - SaaS Subscription & Plan Entitlements Engine')
@Controller('api/rental/subscriptions')
export class RentalSubscriptionsController {
  constructor(private readonly subscriptionsService: RentalSubscriptionsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all available SaaS subscription plans (Starter, Growth, Enterprise)' })
  async getAllPlans() {
    const data = await this.subscriptionsService.getAllPlans();
    return {
      success: true,
      data,
    };
  }

  @Post('plans')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Create a new SaaS subscription tier plan (Super-Admin)' })
  async createPlan(@Body() dto: CreateSubscriptionPlanDto) {
    const data = await this.subscriptionsService.createPlan(dto);
    return {
      success: true,
      message: `Plan '${dto.name}' created successfully.`,
      data,
    };
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Subscribe or Upgrade an Organization to a SaaS subscription plan' })
  async subscribeOrganization(@Body() dto: SubscribeOrganizationDto) {
    const data = await this.subscriptionsService.subscribeOrganization(dto);
    return {
      success: true,
      message: `Organization '${dto.organizationId}' subscribed to plan '${dto.planId}'.`,
      data,
    };
  }

  @Get('organization/:organizationId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get current subscription details & quota entitlements for an organization' })
  async getOrganizationSubscription(@Param('organizationId') organizationId: string) {
    const data = await this.subscriptionsService.getOrganizationSubscription(organizationId);
    return {
      success: true,
      data,
    };
  }
}
