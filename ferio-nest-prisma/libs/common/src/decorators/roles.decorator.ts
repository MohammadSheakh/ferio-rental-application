import { SetMetadata } from '@nestjs/common';

/**
 * Roles Decorator Key
 */
export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Specifies which roles can access a route
 * Used in combination with RolesGuard
 * 
 * Usage:
 * @Roles('admin', 'superadmin')
 * @Get('admin/users')
 * async getAllUsers() { ... }
 * 
 * Only users with 'admin' or 'superadmin' role can access
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
