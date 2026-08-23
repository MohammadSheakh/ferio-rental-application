import { Module, Global, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { SocketGateway } from './socket.gateway';
import { SocketAuthService } from './services/socket-auth.service';
import { SocketRoomService } from './services/socket-room.service';
import { RedisModule } from '@app/redis';
import { PrismaModule } from '@app/database';
import { FirebaseModule } from '@app/notification';
import { ChattingModule } from '../chatting/chatting.module';
import { SocketAuthController } from './socket-auth.controller';

/**
 * Socket Module
 *
 * 📚 REAL-TIME WEBSOCKET MODULE
 */
@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'fallback-secret',
      signOptions: { expiresIn: '7d' },
    }),
    RedisModule,
    PrismaModule,
    FirebaseModule,
    forwardRef(() => ChattingModule),
  ],
  providers: [
    SocketGateway,
    SocketAuthService,
    SocketRoomService,
  ],
  controllers: [SocketAuthController],
  exports: [
    SocketGateway,
    SocketAuthService,
    SocketRoomService,
  ],
})
export class SocketModule {}
