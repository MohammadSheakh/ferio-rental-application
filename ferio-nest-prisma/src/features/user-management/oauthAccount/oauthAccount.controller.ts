import {
  Controller,
  Get,
  Delete,
  UseGuards,
  UseInterceptors,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

import { OAuthAccountService } from './oauthAccount.service';
import { AuthGuard, User, TransformResponseInterceptor } from '@app/common';
import type { UserPayload } from '@app/common';

/**
 * OAuthAccount Controller
 * 
 * Manages OAuth provider accounts linked to users
 */
@ApiTags('OAuth Accounts')
@Controller('users/oauth')
@UseGuards(AuthGuard)
@UseInterceptors(TransformResponseInterceptor)
@ApiBearerAuth()
export class OAuthAccountController {
  constructor(private oauthAccountService: OAuthAccountService) {}

  /**
   * GET /users/oauth/accounts
   * Get linked OAuth accounts for current user
   */
  @Get('accounts')
  @ApiOperation({ 
    summary: 'Get linked OAuth accounts',
    description: 'Get all OAuth providers linked to current user',
  })
  @ApiResponse({ status: 200, description: 'OAuth accounts retrieved successfully' })
  async getLinkedAccounts(@User() user: UserPayload) {
    return await this.oauthAccountService.getUserOAuthAccounts(user.userId);
  }

  /**
   * GET /users/oauth/accounts/list
   * Get full OAuth account details
   */
  @Get('accounts/list')
  @ApiOperation({ 
    summary: 'Get OAuth account details',
    description: 'Get full details of linked OAuth accounts',
  })
  @ApiResponse({ status: 200, description: 'OAuth accounts retrieved successfully' })
  async getOAuthAccounts(@User() user: UserPayload) {
    return await this.oauthAccountService.findByUserId(user.userId);
  }

  /**
   * DELETE /users/oauth/unlink/:provider
   * Unlink OAuth account
   */
  @Delete('unlink/:provider')
  @ApiOperation({ 
    summary: 'Unlink OAuth account',
    description: 'Unlink OAuth provider from user account',
  })
  @ApiResponse({ status: 200, description: 'OAuth account unlinked successfully' })
  @ApiResponse({ status: 404, description: 'OAuth account not found' })
  async unlinkOAuthAccount(
    @User() user: UserPayload,
    @Param('provider') provider: string,
  ) {
    const authProvider = provider.toLowerCase() as 'google' | 'apple';
    await this.oauthAccountService.unlinkOAuthAccount(user.userId, authProvider);
    return { message: 'OAuth account unlinked successfully' };
  }
}
