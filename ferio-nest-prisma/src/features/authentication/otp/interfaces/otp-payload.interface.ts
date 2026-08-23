/**
 * OTP Payload Interface
 * Stored in Redis with TTL
 */
export interface IOtpPayload {
  otp: string;
  createdAt: number;
  attempts: number;
}

export const OtpType = {
  VERIFY: 'verify',
  RESET: 'reset',
} as const;

export type OtpType = (typeof OtpType)[keyof typeof OtpType];
