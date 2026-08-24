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
 * aamarPay JSON API.
 *   initiate: POST {base}/jsonpost.php → payment_url
 *   verify:   GET  {base}/merchant/transaction.php?request_id=…&store_id=…
 *             → { transaction_status: "VALID" | … , amount }
 *
 * Env:
 *   AAMARPAY_STORE_ID / AAMARPAY_SIGNATURE_KEY
 *   AAMARPAY_BASE      (sandbox: https://sandbox.aamarpay.com)
 */
export class AamarPayGateway implements PaymentGatewayDriver {
  readonly name = 'aamarpay' as const;
  private creds?: { base: string; storeId: string; signatureKey: string };

  constructor() {
    const storeId = process.env.AAMARPAY_STORE_ID;
    const signatureKey = process.env.AAMARPAY_SIGNATURE_KEY;
    const base = process.env.AAMARPAY_BASE;
    if (storeId && signatureKey && base) {
      this.creds = { storeId, signatureKey, base: base.replace(/\/$/, '') };
    }
  }

  get configured(): boolean {
    return !!this.creds;
  }

  missingConfig(): string[] {
    return ['AAMARPAY_STORE_ID', 'AAMARPAY_SIGNATURE_KEY', 'AAMARPAY_BASE'].filter(
      (k) => !process.env[k],
    );
  }

  private require() {
    if (!this.creds) {
      throw new GatewayConfigError(
        `aamarPay not configured — set ${this.missingConfig().join(', ')}`,
      );
    }
    return this.creds;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const creds = this.require();
    const res = await postJson(`${creds.base}/jsonpost.php`, {
      store_id: creds.storeId,
      signature_key: creds.signatureKey,
      total_amount: String(input.amountBdt),
      currency: 'BDT',
      tran_id: input.intentId,
      cus_name: input.customer.name ?? 'Ferio Customer',
      cus_email: input.customer.email ?? 'noreply@ferio.com',
      cus_phone: input.customer.phone ?? '',
      desc: input.description.slice(0, 250),
      success_url: `${input.successUrl}?tran_id=${input.intentId}`,
      fail_url: `${input.failureUrl}?tran_id=${input.intentId}`,
      cancel_url: `${input.cancelUrl}?tran_id=${input.intentId}`,
      type: 'json',
    });
    if (!res?.payment_url) {
      throw new Error(`aamarPay initiate failed: ${JSON.stringify(res).slice(0, 250)}`);
    }
    return { gatewayRef: input.intentId, paymentUrl: res.payment_url };
  }

  async verify(input: VerifyInput): Promise<VerifyResult> {
    const creds = this.require();
    const payload = input.callbackPayload ?? {};
    if (payload.status === 'FAILED') {
      return { paid: false, failed: true, detail: 'aamarPay reported failure' };
    }
    if (payload.status === 'CANCELLED') {
      return { paid: false, failed: true, detail: 'customer cancelled' };
    }

    const tranId =
      (payload.tran_id as string) ?? (payload.mer_txnid as string) ?? input.gatewayRef;
    const res = await getJsonSafe(
      `${creds.base}/merchant/transaction.php?request_id=${encodeURIComponent(tranId)}&store_id=${encodeURIComponent(creds.storeId)}`,
    );
    const status = String(res?.transaction_status ?? res?.status ?? '');
    const amount = Number(res?.amount ?? 0);

    if (status.toUpperCase().includes('VALID') && Math.abs(amount - input.amountBdt) <= 0.01) {
      return {
        paid: true,
        failed: false,
        gatewayTxnId: String(res?.bank_ref ?? tranId),
        detail: `aamarPay ${status}`,
      };
    }
    if (amount > 0 && Math.abs(amount - input.amountBdt) > 0.01) {
      return { paid: false, failed: true, detail: `amount mismatch ${amount} ≠ ${input.amountBdt}` };
    }
    return { paid: false, failed: status === 'FAILED', detail: status || 'pending' };
  }
}

async function getJsonSafe(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
