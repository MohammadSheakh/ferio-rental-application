import 'dotenv/config';

/**
 * Shared identity constants. dotenv is loaded HERE so every consumer
 * (JwtModule registration, passport strategy, service) resolves the
 * same values from ferio-nest-prisma/.env regardless of import order.
 */
export const JWT_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'dev-insecure-secret';

export const ACCESS_TTL = '30m';
export const PLATFORM_ACCESS_TTL = '12h';
export const REFRESH_TTL_DAYS = 30;

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
