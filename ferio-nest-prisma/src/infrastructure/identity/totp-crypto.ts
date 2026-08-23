import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Constant-time string comparison (equal length required). */
export function createTimingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export { createHmac, randomBytes };
