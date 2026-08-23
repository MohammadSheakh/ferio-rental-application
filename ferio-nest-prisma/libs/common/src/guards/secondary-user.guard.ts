import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import type { IUserService } from '../types/user-service.interface';
import { I_USER_SERVICE } from '../types/user-service.interface';

/**
 * Secondary User Guard
 * 
 * Logic from senior reference example:
 * - Business users: Always allowed
 * - Child users: Only allowed if granted "Secondary User" status by parent
 */
@Injectable()
export class SecondaryUserGuard implements CanActivate {
  constructor(
    @Inject(I_USER_SERVICE) private readonly userService: IUserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Business users always have permission
    if (user.role === 'business') {
      return true;
    }

    // Child users need secondary permission
    if (user.role === 'child') {
      const isSecondary = await this.userService.isSecondaryUser(user.userId);
      
      if (!isSecondary) {
        throw new ForbiddenException(
          'Only Secondary Users can perform this action. Ask your parent to grant permission.',
        );
      }
      
      return true;
    }

    // Admins or others
    if (user.role === 'admin') {
      return true;
    }

    return false;
  }
}
