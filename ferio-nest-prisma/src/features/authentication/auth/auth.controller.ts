import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OAuthLoginDto } from './dto/oauth-login.dto';
import { TokenSessionDto } from './dto/token-session.dto';
import {
  ResendVerificationDto,
  VerifyEmailDto,
} from './dto/email-verification.dto';
import { CreateOtpDto, VerifyOtpDto } from '../otp/dto/create-otp.dto';
import {
  SlidingWindowRateLimitGuard,
  RateLimit,
  GLOBAL_RATE_LIMITS,
  AuthGuard,
  StructuredLogger,
  User as CurrentUser,
} from '@app/common';
import type { UserPayload } from '@app/common';
import { TwoFactorService } from '../two-factor/two-factor.service';
import {
  DisableTwoFactorDto,
  TwoFactorChallengeDto,
  TwoFactorCodeDto,
} from '../two-factor/two-factor.dto';

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim().split('='))
    .find(([key]) => key === name)?.[1];
}

/**
 * Auth Controller
 *
 * Features:
 * ✅ Sliding Window Rate Limiting (Redis)
 * ✅ brute-force protection via auth preset
 * ✅ HTTP-only cookie management
 * ✅ Global response transformation
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new StructuredLogger(AuthController.name);

  constructor(
    private authService: AuthService,
    private twoFactorService: TwoFactorService,
  ) {}

  @Get('session')
  @UseGuards(AuthGuard)
  session(@CurrentUser() user: UserPayload) {
    return {
      userId: user.userId,
      email: user.email,
      role: user.role,
      permissions: user.permissions ?? [],
    };
  }

  /**
   * POST /auth/login
   * Authenticate user and return tokens
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SlidingWindowRateLimitGuard)
  @RateLimit(GLOBAL_RATE_LIMITS.auth)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user with email and password',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SlidingWindowRateLimitGuard)
  @RateLimit(GLOBAL_RATE_LIMITS.auth)
  @ApiOperation({
    summary: 'Admin login',
    description: 'Authenticate a Ferio staff administrator',
  })
  @ApiResponse({ status: 200, description: 'Admin login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or role' })
  async adminLogin(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginAdmin(loginDto);
    if ('requiresTwoFactor' in result) return result;
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('admin/2fa/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SlidingWindowRateLimitGuard)
  @RateLimit(GLOBAL_RATE_LIMITS.auth)
  async verifyAdminTwoFactor(
    @Body() dto: TwoFactorChallengeDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.completeAdminTwoFactor(
      dto.challengeToken,
      dto.code,
    );
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
    return result;
  }

  @Get('admin/2fa')
  @UseGuards(AuthGuard)
  twoFactorStatus(@CurrentUser() user: UserPayload) {
    return this.twoFactorService.status(user.userId);
  }

  @Post('admin/2fa/setup')
  @UseGuards(AuthGuard)
  beginTwoFactorSetup(@CurrentUser() user: UserPayload) {
    return this.twoFactorService.beginEnrollment(user.userId, user.email);
  }

  @Post('admin/2fa/confirm')
  @UseGuards(AuthGuard)
  confirmTwoFactorSetup(
    @CurrentUser() user: UserPayload,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.twoFactorService.confirmEnrollment(user.userId, dto.code);
  }

  @Post('admin/2fa/disable')
  @UseGuards(AuthGuard)
  disableTwoFactor(
    @CurrentUser() user: UserPayload,
    @Body() dto: DisableTwoFactorDto,
  ) {
    return this.twoFactorService.disable(user.userId, dto.password, dto.code);
  }

  /**
   * POST /auth/register
   * Register new user
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(SlidingWindowRateLimitGuard)
  @RateLimit(GLOBAL_RATE_LIMITS.strict)
  @ApiOperation({
    summary: 'User registration',
    description: 'Register a new user account',
  })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'Email already exists' })
  async register(@Body() registerDto: RegisterDto) {
    return await this.authService.register(registerDto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SlidingWindowRateLimitGuard)
  @RateLimit(GLOBAL_RATE_LIMITS.strict)
  @ApiOperation({ summary: 'Verify a customer email and establish a session' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyEmail(dto.email, dto.otp);
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);
    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SlidingWindowRateLimitGuard)
  @RateLimit(GLOBAL_RATE_LIMITS.strict)
  @ApiOperation({ summary: 'Resend a customer email verification code' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendEmailVerification(dto.email);
  }

  /**
   * POST /auth/oauth
   * OAuth login (Google)
   *
   * @param oauthLoginDto - OAuth login data
   * @param res - Express response (for cookies)
   * @returns User info and access token
   */
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SlidingWindowRateLimitGuard)
  @RateLimit(GLOBAL_RATE_LIMITS.auth)
  @ApiOperation({
    summary: 'OAuth login (Google)',
    description: 'Authenticate a customer with a verified Google ID token',
  })
  @ApiResponse({ status: 200, description: 'OAuth login successful' })
  @ApiResponse({ status: 401, description: 'Invalid OAuth token' })
  async oauthLogin(
    @Body() oauthLoginDto: OAuthLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.oauthLogin(oauthLoginDto);

    // Set refresh token in HTTP-only cookie
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

    return {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   *
   * @param req - Express request (for cookies)
   * @returns New access token and refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SlidingWindowRateLimitGuard)
  @RateLimit(GLOBAL_RATE_LIMITS.auth)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Get new access token using refresh token',
  })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refresh(
    @Req() req: Request,
    @Body() dto: TokenSessionDto = {},
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = getCookie(req, 'refreshToken') || dto.refreshToken;

    if (!refreshToken) {
      this.logger.warn('authentication_refresh_rejected', {
        reason: 'TOKEN_MISSING',
      });
      throw new UnauthorizedException('Refresh token not found');
    }

    const result = await this.authService.refreshToken(refreshToken);

    // Set new refresh token in cookie
    res.cookie('refreshToken', result.refreshToken, refreshCookieOptions);

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  /**
   * POST /auth/logout
   * Logout user and blacklist refresh token
   *
   * @param req - Express request (for cookies)
   * @returns Success message
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User logout',
    description: 'Logout user and invalidate refresh token',
  })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(
    @Req() req: Request,
    @Body() dto: TokenSessionDto = {},
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = getCookie(req, 'refreshToken') || dto.refreshToken;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken', refreshCookieOptions);

    return { message: 'Logout successful' };
  }

  /**
   * POST /auth/forgot-password
   * Send password reset OTP
   *
   * @param createOtpDto - Email and OTP type
   * @returns Success message
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forgot password',
    description: 'Send password reset OTP to email',
  })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  async forgotPassword(@Body() createOtpDto: CreateOtpDto) {
    await this.authService.forgotPassword(createOtpDto.email);
    return { message: 'Password reset OTP sent successfully' };
  }

  /**
   * POST /auth/verify-otp
   * Verify OTP for email verification or password reset
   *
   * @param verifyOtpDto - Email, OTP, and type
   * @returns Success message
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP',
    description: 'Verify OTP for email verification or password reset',
  })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    await this.authService.verifyOtp(
      verifyOtpDto.email,
      verifyOtpDto.otp,
      verifyOtpDto.type,
    );
    return { message: 'OTP verified successfully' };
  }

  /**
   * POST /auth/reset-password
   * Reset password with OTP verification
   *
   * @param body - Email, OTP, and new password
   * @returns Success message
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password with OTP verification',
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid OTP' })
  async resetPassword(
    @Body() body: { email: string; otp: string; newPassword: string },
  ) {
    await this.authService.resetPassword(
      body.email,
      body.otp,
      body.newPassword,
    );
    return { message: 'Password reset successful' };
  }
}
