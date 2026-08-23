import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '@app/database';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async status(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true },
    });
    return { enabled: user?.twoFactorEnabled ?? false };
  }

  async beginEnrollment(userId: string, email: string) {
    const secret = this.base32Encode(randomBytes(20));
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorPendingEncrypted: this.encrypt(secret) },
    });
    const issuer = this.config.get<string>('TWO_FACTOR_ISSUER', 'Ferio Admin');
    const label = `${issuer}:${email}`;
    const uri = `otpauth://totp/${encodeURIComponent(label)}?${new URLSearchParams(
      {
        secret,
        issuer,
        algorithm: 'SHA1',
        digits: '6',
        period: '30',
      },
    )}`;
    return { secret, uri };
  }

  async confirmEnrollment(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorPendingEncrypted: true },
    });
    if (!user?.twoFactorPendingEncrypted) {
      throw new BadRequestException('Two-factor setup has not started');
    }
    const secret = this.decrypt(user.twoFactorPendingEncrypted);
    if (!this.verifyTotp(secret, code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    const recoveryCodes = Array.from({ length: 8 }, () =>
      randomBytes(5).toString('hex').toUpperCase(),
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecretEncrypted: user.twoFactorPendingEncrypted,
        twoFactorPendingEncrypted: null,
        twoFactorRecoveryCodeHashes: recoveryCodes.map((item) =>
          this.hashRecoveryCode(item),
        ),
        staffSessionVersion: { increment: 1 },
      },
    });
    return { recoveryCodes };
  }

  async verifyUserCode(
    user: {
      id: string;
      twoFactorSecretEncrypted: string | null;
      twoFactorRecoveryCodeHashes: string[];
    },
    code: string,
  ) {
    if (!user.twoFactorSecretEncrypted) return false;
    const normalized = code.replace(/[\s-]/g, '').toUpperCase();
    if (
      this.verifyTotp(this.decrypt(user.twoFactorSecretEncrypted), normalized)
    ) {
      return true;
    }
    const hash = this.hashRecoveryCode(normalized);
    const index = user.twoFactorRecoveryCodeHashes.findIndex((item) =>
      this.safeEqual(item, hash),
    );
    if (index < 0) return false;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorRecoveryCodeHashes: user.twoFactorRecoveryCodeHashes.filter(
          (_item, itemIndex) => itemIndex !== index,
        ),
      },
    });
    return true;
  }

  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
        twoFactorSecretEncrypted: true,
        twoFactorRecoveryCodeHashes: true,
      },
    });
    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid password');
    }
    if (!(await this.verifyUserCode(user, code))) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecretEncrypted: null,
        twoFactorPendingEncrypted: null,
        twoFactorRecoveryCodeHashes: [],
        staffSessionVersion: { increment: 1 },
      },
    });
    return { message: 'Two-factor authentication disabled' };
  }

  private verifyTotp(secret: string, code: string) {
    if (!/^\d{6}$/.test(code)) return false;
    const counter = Math.floor(Date.now() / 30_000);
    return [-1, 0, 1].some((offset) =>
      this.safeEqual(this.totp(secret, counter + offset), code),
    );
  }

  private totp(secret: string, counter: number) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', this.base32Decode(secret))
      .update(buffer)
      .digest();
    const offset = digest[digest.length - 1] & 15;
    const value =
      ((digest[offset] & 127) << 24) |
      ((digest[offset + 1] & 255) << 16) |
      ((digest[offset + 2] & 255) << 8) |
      (digest[offset + 3] & 255);
    return String(value % 1_000_000).padStart(6, '0');
  }

  private encryptionKey() {
    const value = this.config.get<string>('TWO_FACTOR_ENCRYPTION_KEY');
    if (!value || value.length < 32) {
      throw new Error(
        'TWO_FACTOR_ENCRYPTION_KEY must be at least 32 characters',
      );
    }
    return createHash('sha256').update(value).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((item) => item.toString('base64url'))
      .join('.');
  }

  private decrypt(value: string) {
    const [iv, tag, encrypted] = value
      .split('.')
      .map((item) => Buffer.from(item, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString();
  }

  private hashRecoveryCode(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    );
  }

  private base32Encode(value: Buffer) {
    let bits = '';
    for (const byte of value) bits += byte.toString(2).padStart(8, '0');
    return bits
      .match(/.{1,5}/g)!
      .map((chunk) => BASE32[parseInt(chunk.padEnd(5, '0'), 2)])
      .join('');
  }

  private base32Decode(value: string) {
    const bits = [...value]
      .map((character) =>
        BASE32.indexOf(character).toString(2).padStart(5, '0'),
      )
      .join('');
    return Buffer.from(
      bits.match(/.{8}/g)?.map((chunk) => parseInt(chunk, 2)) ?? [],
    );
  }
}
