import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { sanitizeUrlForLogs } from '../utils/log-sanitizer';
import { RequestMetrics } from '../utils/request-metrics';
import { StructuredLogger } from '../utils/structured-logger';

/**
 * Logging Interceptor
 *
 * 📚 INDUSTRY STANDARD IMPLEMENTATION
 *
 * Logs all HTTP requests with:
 * - Request method and URL
 * - Response status code
 * - Response time
 * - User ID (if authenticated)
 *
 * Features:
 * ✅ Structured logging
 * ✅ Response time tracking
 * ✅ User context logging
 * ✅ Error logging
 *
 * Usage:
 * @UseInterceptors(LoggingInterceptor)
 * async getData() { ... }
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new StructuredLogger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, url, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = this.getClientIP(request);

    // Get user ID if authenticated
    const user = request as any;
    const userId = user.user?.userId || 'anonymous';

    // Start time for response time calculation
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;

          RequestMetrics.record({
            statusCode: response.statusCode,
            durationMs: responseTime,
          });

          this.logger.log('http_request_completed', {
            method,
            path: sanitizeUrlForLogs(url),
            statusCode: response.statusCode,
            durationMs: responseTime,
            userId,
            clientIp: ip,
          });
        },
        error: (error: unknown) => {
          const statusCode =
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            typeof error.status === 'number'
              ? error.status
              : 500;
          RequestMetrics.record({
            statusCode,
            durationMs: Date.now() - now,
          });
        },
      }),
    );
  }

  /**
   * Get client IP address
   * Handles proxied requests (e.g., behind nginx, load balancer)
   */
  /**
   * Resolve the original client IP.
   *
   * Priority:
   * 1. Cloudflare CF-Connecting-IP
   * 2. X-Forwarded-For
   * 3. Express request.ip
   * 4. Socket remote address
   */
  private getClientIP(request: Request): string {
    // Cloudflare: original visitor IP
    // const cfConnectingIp = request.headers['cf-connecting-ip'];

    // if (typeof cfConnectingIp === 'string' && cfConnectingIp) {
    //   return cfConnectingIp.trim();
    // }

    // // Standard reverse-proxy header
    // const forwarded = request.headers['x-forwarded-for'];

    // if (typeof forwarded === 'string') {
    //   return forwarded.split(',')[0].trim();
    // }

    // return request.ip || request.socket?.remoteAddress || 'unknown';

    const cfConnectingIp = request.headers['cf-connecting-ip'];

    if (typeof cfConnectingIp === 'string' && cfConnectingIp.trim()) {
      return cfConnectingIp.trim();
    }

    if (Array.isArray(cfConnectingIp) && cfConnectingIp.length > 0) {
      return cfConnectingIp[0].trim();
    }

    const forwardedFor = request.headers['x-forwarded-for'];

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0].split(',')[0].trim();
    }

    return request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
