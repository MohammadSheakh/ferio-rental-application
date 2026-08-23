import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Prisma, UserDevices } from '@prisma/client';
import { GenericService } from '@app/common';
import { PrismaService } from '@app/database';
import { DeviceType } from './enums/TDevice.enum';

const publicUserDeviceSelect = {
  id: true,

  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserDevicesSelect;

/**
 * UserDevices Service
 * 
 * Manages user devices for push notifications
 * Extends GenericService for CRUD operations
 */
@Injectable()
export class UserDevicesService extends GenericService<Prisma.UserDevicesDelegate, Partial<UserDevices>> {
  constructor(
    private readonly prisma: PrismaService,
  ) {
    super(prisma.userDevices, publicUserDeviceSelect);
  }

  /**
   * Register or update device
   */
  async registerOrUpdateDevice(
    userId: string,
    fcmToken: string,
    deviceType: DeviceType,
    deviceName?: string,
  ): Promise<UserDevices> {
    const existingDevice = await this.prisma.userDevices.findFirst({
      where: { fcmToken, userId, isDeleted: false },
    });

    if (existingDevice) {
      return this.prisma.userDevices.update({
        where: { id: existingDevice.id },
        data: {
          lastActive: new Date(),
          deviceType,
          deviceName: deviceName || existingDevice.deviceName,
        },
      });
    }

    return this.prisma.userDevices.create({
      data: {
        userId,
        fcmToken,
        deviceType,
        deviceName,
        lastActive: new Date(),
      },
    });
  }

  /**
   * Get all devices for user
   */
  async getUserDevices(userId: string): Promise<UserDevices[]> {
    return this.prisma.userDevices.findMany({
      where: { userId, isDeleted: false },
      orderBy: { lastActive: 'desc' },
    });
  }

  /**
   * Get device by FCM token
   */
  async getDeviceByToken(fcmToken: string): Promise<UserDevices | null> {
    return this.prisma.userDevices.findFirst({
      where: { fcmToken, isDeleted: false },
    });
  }

  /**
   * Update last active timestamp
   */
  async updateLastActive(deviceId: string): Promise<UserDevices | null> {
    return this.prisma.userDevices.update({
      where: { id: deviceId },
      data: { lastActive: new Date() },
    });
  }

  /**
   * Remove device (soft delete)
   */
  async removeDevice(userId: string, deviceId: string): Promise<UserDevices | null> {
    const device = await this.prisma.userDevices.findFirst({
      where: { id: deviceId, userId, isDeleted: false },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return this.prisma.userDevices.update({
      where: { id: deviceId },
      data: {
        isDeleted: true,
      },
    });
  }

  /**
   * Remove device by FCM token
   */
  async removeDeviceByToken(userId: string, fcmToken: string): Promise<void> {
    await this.prisma.userDevices.updateMany({
      where: { fcmToken, userId },
      data: {
        isDeleted: true,
      },
    });
  }

  /**
   * Get all active devices for user (for push notifications)
   */
  async getActiveDevices(userId: string): Promise<UserDevices[]> {
    return this.prisma.userDevices.findMany({
      where: { userId, pushEnabled: true, isDeleted: false },
    });
  }

  /**
   * Cleanup old inactive devices (older than 1 year)
   */
  async cleanupInactiveDevices(): Promise<number> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = await this.prisma.userDevices.updateMany({
      where: {
        lastActive: { lt: oneYearAgo },
        isDeleted: false,
      },
      data: {
        isDeleted: true,
      },
    });

    return result.count;
  }

  /**
   * Enable/disable push notifications for device
   */
  async updatePushEnabled(deviceId: string, enabled: boolean): Promise<UserDevices | null> {
    return this.prisma.userDevices.update({
      where: { id: deviceId },
      data: { pushEnabled: enabled },
    });
  }
}
