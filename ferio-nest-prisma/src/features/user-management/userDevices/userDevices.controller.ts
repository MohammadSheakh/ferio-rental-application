import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { UserDevicesService } from './userDevices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';
import { AuthGuard, User, TransformResponseInterceptor } from '@app/common';
import type { UserPayload } from '@app/common';

/**
 * UserDevices Controller
 * 
 * Manages user devices for push notifications
 */
@ApiTags('User Devices')
@Controller('users/devices')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@ApiBearerAuth()
export class UserDevicesController {
  constructor(private userDevicesService: UserDevicesService) {}

  /**
   * POST /users/devices/register
   * Register or update device
   */
  @Post('register')
  @ApiOperation({ 
    summary: 'Register device',
    description: 'Register or update device for push notifications',
  })
  @ApiResponse({ status: 201, description: 'Device registered successfully' })
  async registerDevice(
    @User() user: UserPayload,
    @Body() registerDeviceDto: RegisterDeviceDto,
  ) {
    return await this.userDevicesService.registerOrUpdateDevice(
      user.userId,
      registerDeviceDto.fcmToken,
      registerDeviceDto.deviceType,
      registerDeviceDto.deviceName,
    );
  }

  /**
   * GET /users/devices
   * Get all user devices
   */
  @Get()
  @ApiOperation({ 
    summary: 'Get my devices',
    description: 'Get all registered devices for current user',
  })
  @ApiResponse({ status: 200, description: 'Devices retrieved successfully' })
  async getUserDevices(@User() user: UserPayload) {
    return await this.userDevicesService.getUserDevices(user.userId);
  }

  /**
   * DELETE /users/devices/:deviceId
   * Remove device
   */
  @Delete(':deviceId')
  @ApiOperation({ 
    summary: 'Remove device',
    description: 'Remove a registered device',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Device removed successfully' })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async removeDevice(
    @User() user: UserPayload,
    @Param('deviceId') deviceId: string,
  ) {
    return await this.userDevicesService.removeDevice(user.userId, deviceId);
  }

  /**
   * PUT /users/devices/:deviceId/push
   * Update push notification settings
   */
  @Put(':deviceId/push')
  @ApiOperation({ 
    summary: 'Update push settings',
    description: 'Enable/disable push notifications for device',
  })
  @ApiParam({ name: 'deviceId', description: 'Device ID' })
  @ApiResponse({ status: 200, description: 'Push settings updated successfully' })
  async updatePushSettings(
    @User() user: UserPayload,
    @Param('deviceId') deviceId: string,
    @Body('enabled') enabled: boolean,
  ) {
    return await this.userDevicesService.updatePushEnabled(deviceId, enabled);
  }

  /**
   * POST /users/devices/remove-by-token
   * Remove device by FCM token
   */
  @Post('remove-by-token')
  @ApiOperation({ 
    summary: 'Remove device by token',
    description: 'Remove device using FCM token',
  })
  @ApiResponse({ status: 200, description: 'Device removed successfully' })
  async removeDeviceByToken(
    @User() user: UserPayload,
    @Body('fcmToken') fcmToken: string,
  ) {
    await this.userDevicesService.removeDeviceByToken(user.userId, fcmToken);
    return { message: 'Device removed successfully' };
  }
}
