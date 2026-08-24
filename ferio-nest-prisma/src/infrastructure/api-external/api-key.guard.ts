import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyService, type ResolvedApiKey } from './api-key.service';

/** Simple fixed-window limiter per API key (per process). */
const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.EXTERNAL_API_RATE_LIMIT || 120);
const buckets = new Map<string, { count: number; windowStart: number }>();

export interface ExternalRequest extends Request {
  apiKey?: ResolvedApiKey;
}

function setRateHeaders(res: Response | undefined, limit: number, remaining: number, resetSec: number) {
  res?.setHeader('X-RateLimit-Limit', String(limit));
  res?.setHeader('X-RateLimit-Remaining', String(Math.max(0, remaining)));
  res?.setHeader('X-RateLimit-Reset', String(Math.ceil(resetSec)));
}
type Response = import('express').Response;

/**
 * § Week 33 — authenticates `Authorization: Bearer fk_live_…` keys and
 * enforces per-key rate limits. Scope checks are applied per-route via
 * the `RequireApiScope` decorator + scopes guard.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeys: ApiKeyService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const http = ctx.switchToHttp();
    const req = http.getRequest<ExternalRequest>();
    const res = http.getResponse<Response>();

    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw new UnauthorizedException('Missing API key');

    const resolved = await this.apiKeys.resolve(token);
    if (!resolved) throw new UnauthorizedException('Invalid or revoked API key');
    req.apiKey = resolved;

    // Fixed one-minute window per key
    const now = Date.now();
    let bucket = buckets.get(resolved.clientId);
    if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
      bucket = { count: 0, windowStart: now };
      buckets.set(resolved.clientId, bucket);
    }
    bucket.count += 1;
    const remaining = LIMIT - bucket.count;
    const resetSec = (bucket.windowStart + WINDOW_MS - now) / 1000;
    setRateHeaders(res, LIMIT, remaining, resetSec);

    if (bucket.count > LIMIT) {
      throw new HttpException('Rate limit exceeded', 429);
    }
    return true;
  }
}
