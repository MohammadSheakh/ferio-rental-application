import {
  GatewayConfigError,
  type InitiateInput,
  type InitiateResult,
  type PaymentGatewayDriver,
  type VerifyInput,
  type VerifyResult,
  postJson,
} from '../gateway.types';

/**
 * ShurjoPay online API.
 *   initiate: POST {base}/api/get_token → token
 *             POST {base}/api/create   → checkout_url + id
 *   verify:   POST {base}/api/verification {token, order_id}
 *             → transaction_status
 *
 * Env:
 *   SHURJOPAY_USERNAME / SHURJOPAY_PASSWORD
 *   SHURJOPAY_BASE     (sandbox: https://sandbox.shurjopayment.com)
 */
export class ShurjoPayGateway implements PaymentGatewayDriver {
  readonly name = 'shurjopay' as const;
  private creds?: { base: string; username: string; password: string };
  private cachedToken?: { token: string; expiresAt: number };

  constructor() {
    const base = process.env.SHURJOPAY_BASE;
    const username = process.env.SHURJOPAY_USERNAME;
    const password = process.env.SHURJOPAY_PASSWORD;
    if (base && username && password) {
      this.creds = { base: base.replace(/\/$/, ''), username, password };
    }
  }

  get configured(): boolean {
    return !!this.creds;
  }

  missingConfig(): string[] {
    return ['SHURJOPAY_BASE', 'SHURJOPAY_USERNAME', 'SHURJOPAY_PASSWORD'].filter(
      (k) => !process.env[k],
    );
  }

  private require() {
    if (!this.creds) {
      throw new GatewayConfigError(
        `ShurjoPay not configured — set ${this.missingConfig().join(', ')}`,
      );
    }
    return this.creds;
  }

  private async tokenOf(creds: ReturnType<ShurjoPayGateway['require']>): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.token;
    }
    const res = await postJson(`${creds.base}/api/get_token`, {
      username: creds.username,
      password: creds.password,
    });
    if (!res?.token) {
      throw new Error(`ShurjoPay token failed: ${JSON.stringify(res).slice(0, 200)}`);
    }
    // Tokens are short-lived (~1h); cache with margin using token_expires_in when present.
    const expiresInSec = Number(res.token_expires_in ?? 3600);
    this.cachedToken = { token: res.token, expiresAt: Date.now() + (expiresInSec - 60) * 1000 };
    return res.token;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const creds = this.require();
    const token = await this.tokenOf(creds);
    const res = await postJson(
      `${creds.base}/api/create`,
      {
        prefix: 'ferio',
        token,
        return_url: input.successUrl,
        cancel_url: input.cancelUrl,
        store_id: creds.username, // SP uses the merchant username as store id
        amount: String(input.amountBdt),
        currency: 'BDT',
        customer_order_id: input.intentId,
        order_id: input.intentId,
        customer_name: input.customer.name ?? 'Ferio Customer',
        customer_address: 'Dhaka',
        customer_phone: input.customer.phone ?? '',
        customer_city: 'Dhaka',
        customer_email: input.customer.email ?? 'noreply@ferio.com',
        client_ip: '127.0.0.1',
        intent: 'SALE',
      },
      { Authorization: `Bearer ${token}` },
    );
    if (!res?.checkout_url) {
      throw new Error(`ShurjoPay create failed: ${JSON.stringify(res).slice(0, 250)}`);
    }
    return { gatewayRef: String(res.id ?? res.order_id ?? input.intentId), paymentUrl: res.checkout_url };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const creds = this.require();
    const token = await this.tokenOf(creds);
    const orderId =
      ((input.callbackPayload as any)?.order_id as string) || input.gatewayRef;

    const res = await postJson(
      `${creds.base}/api/verification`,
      { token, order_id: orderId },
      { Authorization: `Bearer ${token}` },
    ).catch(() => null);

    const list = Array.isArray(res) ? res : res ? [res] : [];
    const record = list[0] ?? {};
    const status = String(record.transaction_status ?? '').toUpperCase();
    const amount = Number(record.amount ?? 0);

    // § P0 money fix: strict amount match — a gateway echo of 0 (unknown)
    // must NOT pass as paid.
    if (amount > 0 && Math.abs(amount - input.amountBdt) > 0.01) {
      return { paid: false, failed: true, detail: `amount mismatch ${amount} ≠ ${input.amountBdt}` };
    }
    if ((status === 'SUCCESS' || status === 'COMPLETED') && amount > 0) {
      return {
        paid: true,
        failed: false,
        gatewayTxnId: String(record.transaction_id ?? orderId),
        detail: `ShurjoPay ${status}`,
      };
    }
    if (amount > 0 && Math.abs(amount - input.amountBdt) > 0.01) {
      return { paid: false, failed: true, detail: `amount mismatch ${amount} ≠ ${input.amountBdt}` };
    }
    if (status === 'FAILED') {
      return { paid: false, failed: true, detail: 'ShurjoPay reported failure' };
    }
    return { paid: false, failed: false, detail: status || 'pending' };
  }
}
