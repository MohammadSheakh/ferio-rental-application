import { SetMetadata } from '@nestjs/common';

/**
 * Public Decorator Key
 * Used to mark routes that don't require authentication
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Public Decorator
 * 
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 * 
 * Usage:
 * @Public()
 * @Post('login')
 * async login(@Body() loginDto: LoginDto) { ... }
 * 
 * This route will bypass AuthGuard authentication
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
