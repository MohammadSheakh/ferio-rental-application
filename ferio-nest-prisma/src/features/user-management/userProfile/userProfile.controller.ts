import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { UserProfileService } from './userProfile.service';
import { UpdateUserProfileDto } from './dto/update-userProfile.dto';
import { AuthGuard, User, TransformResponseInterceptor } from '@app/common';
import type { UserPayload } from '@app/common';

/**
 * UserProfile Controller
 * 
 * Manages user profile operations
 */
@ApiTags('User Profile')
@Controller('users/profile')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@ApiBearerAuth()
export class UserProfileController {
  constructor(private userProfileService: UserProfileService) {}

  /**
   * GET /users/profile/details
   * Get current user profile details
   */
  @Get('details')
  @ApiOperation({ 
    summary: 'Get my profile details',
    description: 'Get current user profile with extended information',
  })
  @ApiResponse({ status: 200, description: 'Profile details retrieved successfully' })
  async getProfileDetails(@User() user: UserPayload) {
    return await this.userProfileService.findByUserIdWithCache(user.userId);
  }

  /**
   * PUT /users/profile/details
   * Update current user profile details
   */
  @Put('details')
  @ApiOperation({ 
    summary: 'Update my profile details',
    description: 'Update current user profile information (location, dob, gender, etc.)',
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfileDetails(
    @User() user: UserPayload,
    @Body() updateProfileDto: UpdateUserProfileDto,
  ) {
    return await this.userProfileService.updateByUserId(user.userId, updateProfileDto);
  }

  /**
   * PUT /users/profile/support-mode
   * Update support mode preference
   */
  @Put('support-mode')
  @ApiOperation({ 
    summary: 'Update support mode',
    description: 'Update user support mode preference (calm/encouraging/logical)',
  })
  @ApiResponse({ status: 200, description: 'Support mode updated successfully' })
  async updateSupportMode(
    @User() user: UserPayload,
    @Body('supportMode') supportMode: string,
  ) {
    return await this.userProfileService.updateSupportMode(user.userId, supportMode);
  }

  /**
   * PUT /users/profile/notification-style
   * Update notification style preference
   */
  @Put('notification-style')
  @ApiOperation({ 
    summary: 'Update notification style',
    description: 'Update user notification style preference (gentle/firm/neutral)',
  })
  @ApiResponse({ status: 200, description: 'Notification style updated successfully' })
  async updateNotificationStyle(
    @User() user: UserPayload,
    @Body('notificationStyle') notificationStyle: string,
  ) {
    return await this.userProfileService.updateNotificationStyle(user.userId, notificationStyle);
  }

  /**
   * GET /users/profile/full
   * Get profile with user details
   */
  @Get('full')
  @ApiOperation({ 
    summary: 'Get full profile',
    description: 'Get user profile with user details',
  })
  @ApiResponse({ status: 200, description: 'Full profile retrieved successfully' })
  async getFullProfile(@User() user: UserPayload) {
    return await this.userProfileService.getProfileWithUser(user.userId);
  }
}
