import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

import { AuthGuard, Public, User } from '@app/common';
import type { UserPayload } from '@app/common';
import { SocketAuthService } from './services/socket-auth.service';

class GuestSocketTicketDto {
  @IsString()
  @Matches(/^gst_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  guestId: string;
}

@Controller('socket-auth')
export class SocketAuthController {
  constructor(private readonly socketAuthService: SocketAuthService) {}

  @Post('ticket')
  @UseGuards(AuthGuard)
  async issueAuthenticatedTicket(@User() user: UserPayload) {
    const token = await this.socketAuthService.issueSocketTicket(user);
    return { token, expiresInSeconds: 300 };
  }

  @Post('guest-ticket')
  @Public()
  async issueGuestTicket(@Body() dto: GuestSocketTicketDto) {
    const token = await this.socketAuthService.issueGuestSocketTicket(dto.guestId);
    if (!token) throw new BadRequestException('A valid guest chat ID is required');
    return { token, expiresInSeconds: 300 };
  }
}
