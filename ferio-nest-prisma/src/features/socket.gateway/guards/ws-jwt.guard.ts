import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

/**
 * WebSocket JWT Guard
 *
 * 📚 SOCKET.IO AUTHENTICATION GUARD
 *
 * Validates JWT tokens for WebSocket connections
 * Compatible with Express.js socket authentication
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();

      const token = client.handshake.auth.token || client.handshake.headers.token as string;

      if (!token) {
        throw new WsException('Authentication token required');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET || 'fallback-secret',
      });

      if (!payload || !payload.userId) {
        throw new WsException('Invalid authentication token');
      }

      // Attach user to socket data
      client.data.user = payload;
      client.data.userId = payload.userId;

      return true;
    } catch (error) {
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('Authentication failed');
    }
  }
}
