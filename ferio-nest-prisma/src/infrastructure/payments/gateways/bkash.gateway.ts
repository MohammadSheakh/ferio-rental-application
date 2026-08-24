import {
  GatewayConfigError,
  type InitiateInput,
  type InitiateResult,
  type PaymentGatewayDriver,
  type VerifyInput,
  type VerifyResult,
  getJson,
  postJson,
} from '../gateway.types';

/**
 * bKash Tokenized Checkout (v1.2.0-beta) — the standard e-commerce
 * integration: grant token → create → redirect customer to bkashURL →
 * execute paymentID on callback → confirm transactionStatus Completed.
 *
 * Env:
 *   BKASH_BASE       (sandbox: https://tokenized.sandbox.bka.sh/v1.2.0-beta)
 *   BKASH_APP_KEY / BKASH_APP_SECRET / BKASH_USERNAME / BKASH_PASSWORD
 */
interface BkashCreds {
  base: string;
  appKey: string;
  appSecret: string;
  username: string;
  password: string;
}

export class BkashGateway implements PaymentGatewayDriver {
  readonly name = 'bkash' as const;
  private creds?: BkashCreds;
  private idToken?: { token: string; expiresAt: number };

  constructor() {
    const base = process.env.BKASH_BASE;
    const appKey = process.env.BKASH_APP_KEY;
    const appSecret = process.env.BKASH_APP_SECRET;
    const username = process.env.BKASH_USERNAME;
    const password = process.env.BKASH_PASSWORD;
    if (base && appKey && appSecret && username && password) {
      this.creds = { base: base.replace(/\/$/, ''), appKey, appSecret, username, password };
    }
  }

  get configured(): boolean {
    return !!this.creds;
  }

  missingConfig(): string[] {
    return ['BKASH_BASE', 'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USERNAME', 'BKASH_PASSWORD'].filter(
      (k) => !process.env[k],
    );
  }

  private require(): BkashCreds {
    if (!this.creds) {
      throw new GatewayConfigError(
        `bKash not configured — set ${this.missingConfig().join(', ')}`,
      );
    }
    return this.creds;
  }

  private async idTokenOf(creds: BkashCreds): Promise<string> {
    if (this.idToken && this.idToken.expiresAt > Date.now() + 30_000) {
      return this.idToken.token;
    }
    const res = await postJson(`${creds.base}/tokenized/checkout/grant`, {
      app_key: creds.appKey,
      app_secret: creds.appSecret,
    });
    if (!res.id_token) {
      throw new Error(`bKash grant failed: ${JSON.stringify(res).slice(0, 200)}`);
    }
    // bKash tokens live ~1h; refresh with a margin.
    this.idToken = { token: res.id_token, expiresAt: Date.now() + 55 * 60_000 };
    return res.id_token;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const creds = this.require();
    const token = await this.idTokenOf(creds);
    const res = await postJson(
      `${creds.base}/tokenized/checkout/create`,
      {
        mode: '0011',
        payerReference: input.customer.phone ?? input.customer.email ?? input.intentId,
        callbackURL: input.successUrl, // bKash posts status back here; we branch on payload
        amount: String(input.amountBdt),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: input.intentId,
      },
      { Authorization: token, 'X-App-Key': creds.appKey },
    );
    if (!res.paymentID || !res.bkashURL) {
      throw new Error(`bKash create failed: ${JSON.stringify(res).slice(0, 250)}`);
    }
    return { gatewayRef: res.paymentID, paymentUrl: res.bkashURL };
  }

  /** Callback payloads carry paymentID + status; execute to finalize. */
  async verify(input: VerifyInput): Promise<VerifyResult> {
    const creds = this.require();
    const payload = input.callbackPayload ?? {};
    const paymentID =
      (payload.paymentID as string) || input.gatewayRef;
    if (!paymentID) return { paid: false, failed: false, detail: 'no paymentID' };

    const rawStatus = String(payload.status ?? '').toLowerCase();
    if (rawStatus === 'cancel' || rawStatus === 'canceled') {
      return { paid: false, failed: true, detail: 'customer cancelled' };
    }

    const token = await this.idTokenOf(creds);

    if (rawStatus === 'failure') {
      // Execute once to pull the authoritative failure state.
      const exec = await postJson(
        `${creds.base}/tokenized/checkout/execute`,
        { paymentID },
        { Authorization: token, 'X-App-Key': creds.appKey },
      ).catch(() => null);
      return {
        paid: false,
        failed: true,
        detail: `failure (${String(exec?.transactionStatus ?? rawStatus)})`,
      };
    }

    // success / unknown → query authoritative status
    const status = await getJson(
      `${creds.base}/tokenized/checkout/payment/status/${paymentID}`,
      { Authorization: token, 'X-App-Key': creds.appKey },
    ).catch(() => null);

    let txnStatus = String(status?.transactionStatus ?? '');
    if (!txnStatus) {
      const exec = await postJson(
        `${creds.base}/tokenized/checkout/execute`,
        { paymentID },
        { Authorization: token, 'X-App-Key': creds.appKey },
      ).catch(() => null);
      txnStatus = String(exec?.transactionStatus ?? '');
    }

    if (txnStatus === 'Completed') {
      return { paid: true, failed: false, gatewayTxnId: paymentID, detail: 'bKash Completed' };
    }
    return { paid: false, failed: txnStatus === 'Failed', gatewayTxnId: paymentID, detail: txnStatus || 'pending' };
  }
}
