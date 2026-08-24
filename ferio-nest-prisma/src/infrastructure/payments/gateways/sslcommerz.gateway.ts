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
 * SSLCommerz Hosted Checkout — the most common BD aggregator.
 *   initiate: POST /gwprocess/v4/api.php (form-encoded sessionkey request)
 *             → GatewayPageURL
 *   verify:   GET /validator/api/validationserverAPI.php?val_id=…
 *             → status VALID | VALIDATED | FAILED, plus amount echo
 *
 * Env:
 *   SSLCOMMERZ_STORE_ID / SSLCOMMERZ_STORE_PASSWD
 *   SSLCOMMERZ_BASE     (sandbox: https://sandbox.sslcommerz.com)
 */
interface SslCreds {
  base: string;
  storeId: string;
  storePasswd: string;
}

export class SslCommerzGateway implements PaymentGatewayDriver {
  readonly name = 'sslcommerz' as const;
  private creds?: SslCreds;

  constructor() {
    const storeId = process.env.SSLCOMMERZ_STORE_ID;
    const storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD;
    const base = process.env.SSLCOMMERZ_BASE;
    if (storeId && storePasswd && base) {
      this.creds = { storeId, storePasswd, base: base.replace(/\/$/, '') };
    }
  }

  get configured(): boolean {
    return !!this.creds;
  }

  missingConfig(): string[] {
    return ['SSLCOMMERZ_STORE_ID', 'SSLCOMMERZ_STORE_PASSWD', 'SSLCOMMERZ_BASE'].filter(
      (k) => !process.env[k],
    );
  }

  private require(): SslCreds {
    if (!this.creds) {
      throw new GatewayConfigError(
        `SSLCommerz not configured — set ${this.missingConfig().join(', ')}`,
      );
    }
    return this.creds;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const creds = this.require();

    // SSLCommerz takes form-encoded payloads on this endpoint.
    const form = new URLSearchParams({
      store_id: creds.storeId,
      store_passwd: creds.storePasswd,
      total_amount: String(input.amountBdt),
      currency: 'BDT',
      tran_id: input.intentId,
      success_url: `${input.successUrl}?tran_id=${input.intentId}`,
      fail_url: `${input.failureUrl}?tran_id=${input.intentId}`,
      cancel_url: `${input.cancelUrl}?tran_id=${input.intentId}`,
      emi_options: '0',
      shipping_method: 'NO',
      product_name: input.description.slice(0, 255),
      product_category: 'service',
      product_profile: 'general',
      cus_name: input.customer.name ?? 'Ferio Customer',
      cus_email: input.customer.email ?? 'noreply@ferio.com',
      cus_add1: 'Dhaka',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: input.customer.phone ?? '',
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    let json: any;
    try {
      const res = await fetch(`${creds.base}/gwprocess/v4/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        signal: controller.signal,
      });
      json = await res.json();
    } finally {
      clearTimeout(timer);
    }

    if (json?.status !== 'SUCCESS' || !json?.GatewayPageURL) {
      throw new Error(
        `SSLCommerz session failed: ${JSON.stringify(json).slice(0, 250)}`,
      );
    }
    return { gatewayRef: json.sessionkey ?? input.intentId, paymentUrl: json.GatewayPageURL };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const creds = this.require();
    const payload = input.callbackPayload ?? {};
    // IPN/return carries val_id once the customer completes the hosted page.
    const valId =
      (payload.val_id as string) ??
      ((payload.tran_id as string) ? null : null);

    if (!valId && payload.status === 'FAILED') {
      return { paid: false, failed: true, detail: 'hosted page reported failure' };
    }
    if (!valId && payload.status === 'CANCELLED') {
      return { paid: false, failed: true, detail: 'customer cancelled' };
    }
    if (!valId) {
      return { paid: false, failed: false, detail: 'awaiting val_id from gateway' };
    }

    const url =
      `${creds.base}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId as string)}` +
      `&store_id=${encodeURIComponent(creds.storeId)}&store_passwd=${encodeURIComponent(creds.storePasswd)}&format=json`;
    const res = await postJson(url, {}).catch(async () =>
      // validation endpoint is GET-shaped; fall back to fetch directly
      (async () => {
        const r = await fetch(url);
        return r.json();
      })(),
    );

    const status = String(res?.status ?? '');
    const amount = Number(res?.amount ?? 0);
    if (
      (status === 'VALID' || status === 'VALIDATED') &&
      Math.abs(amount - input.amountBdt) <= 0.01
    ) {
      return {
        paid: true,
        failed: false,
        gatewayTxnId: String(res.bank_tran_id ?? valId),
        detail: `SSLCommerz ${status} · ${res.card_type ?? ''}`,
      };
    }
    if (amount > 0 && Math.abs(amount - input.amountBdt) > 0.01) {
      return { paid: false, failed: true, detail: `amount mismatch ${amount} ≠ ${input.amountBdt}` };
    }
    return { paid: false, failed: status === 'FAILED', detail: status || 'pending' };
  }
}
