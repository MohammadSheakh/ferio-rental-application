import { createHmac, randomBytes, createTimingSafeEqual } from './totp-crypto';

/**
 * Minimal RFC-6238 TOTP (HMAC-SHA1, 6 digits, 30s step) with RFC-4648
 * base32 secrets. Self-contained on node:crypto — no third-party deps.
 * Verification tolerates ±1 time-step of clock drift.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Generate a 160-bit secret encoded as base32 (Google Authenticator compatible). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function hotp(secretBase32: string, counter: bigint): string {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(counter);

  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;

  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 1_000_000).padStart(6, '0');
}

export function totpAt(secretBase32: string, epochSeconds: number): string {
  return hotp(secretBase32, BigInt(Math.floor(epochSeconds / 30)));
}

/** Constant-time compare against the current step ±`window`. */
export function verifyTotp(
  secretBase32: string,
  code: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
  window = 1,
): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const currentStep = BigInt(Math.floor(nowEpochSeconds / 30));

  for (let drift = -window; drift <= window; drift++) {
    const candidate = hotp(secretBase32, currentStep + BigInt(drift));
    if (createTimingSafeEqual(candidate, code)) return true;
  }
  return false;
}

/** otpauth:// URI for QR rendering by Google Authenticator & friends. */
export function otpauthUri(
  secretBase32: string,
  accountLabel: string,
  issuer = 'Ferio Platform',
): string {
  return (
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}` +
    `?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
  );
}
