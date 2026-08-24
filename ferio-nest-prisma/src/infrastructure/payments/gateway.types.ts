/**
 * § Week 27 — Bangladesh payment gateway abstraction.
 *
 * Every BD gateway follows the same redirect flow:
 *   initiate → hosted page → customer pays → IPN/callback + return URL
 *   → server-side verification against the gateway API
 *
 * Drivers implement the two primitives; the PaymentsService owns intent
 * persistence and fulfillment. Real drivers activate only when their
 * credentials are present in env; `mock` is always available for dev/E2E
 * (same pattern as StorageService's s3/local split).
 */
export type GatewayName = 'bkash' | 'sslcommerz' | 'aamarpay' | 'shurjopay' | 'mock';

export interface InitiateInput {
  /** Unique reference we control (PaymentIntent id). */
  intentId: string;
  amountBdt: number;
  description: string;
  customer: { name?: string; email?: string; phone?: string };
  /** URLs the gateway redirects / posts back to. */
  successUrl: string;
  failureUrl: string;
  cancelUrl: string;
}

export interface InitiateResult {
  gatewayRef: string;
  paymentUrl: string;
}

export interface VerifyInput {
  gatewayRef: string;
  intentId: string;
  amountBdt: number;
  /** Raw callback payload when the gateway POSTs an IPN. */
  callbackPayload?: Record<string, unknown>;
}

export interface VerifyResult {
  paid: boolean;
  failed: boolean; // definitive failure (vs "not yet")
  gatewayTxnId?: string;
  detail?: string;
}

export interface PaymentGatewayDriver {
  readonly name: GatewayName;
  readonly configured: boolean;
  missingConfig?(): string[];
  initiate(input: InitiateInput): Promise<InitiateResult>;
  verify(input: VerifyInput): Promise<VerifyResult>;
}

export class GatewayConfigError extends Error {}

/** Small JSON fetch helper with timeout + error normalization. */
export async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    try {
      return { status: res.status, ...(JSON.parse(text) as object) } as any;
    } catch {
      throw new Error(`gateway returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    try {
      return { status: res.status, ...(JSON.parse(text) as object) } as any;
    } catch {
      throw new Error(`gateway returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
