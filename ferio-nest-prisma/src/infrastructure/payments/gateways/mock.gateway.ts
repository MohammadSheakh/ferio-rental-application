import type { InitiateInput, InitiateResult, PaymentGatewayDriver, VerifyInput, VerifyResult } from '../gateway.types';

/**
 * Sandbox/dev driver — no external network. "Hosted page" is served by
 * the PaymentsController at /payments/sandbox/:intentId; confirming it
 * calls verify() with the simulated outcome. Always available.
 */
export class MockGateway implements PaymentGatewayDriver {
  readonly name = 'mock' as const;
  get configured(): boolean {
    return true;
  }

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    // The controller exposes GET /payments/sandbox/:intentId as the page.
    const base = process.env.MOCK_GATEWAY_PUBLIC_URL ?? 'http://localhost:6799/api/v1/payments';
    return {
      gatewayRef: `mock_${input.intentId}`,
      paymentUrl: `${base}/sandbox/${input.intentId}`,
    };
  }

  /**
   * Outcome is driven by the sandbox confirm endpoint via callbackPayload:
   * { sandbox: 'success' | 'fail' | 'cancel', gatewayTxnId? }
   */
  async verify(input: VerifyInput): Promise<VerifyResult> {
    const outcome = String((input.callbackPayload as any)?.sandbox ?? 'success');
    if (outcome === 'success') {
      return {
        paid: true,
        failed: false,
        gatewayTxnId: (input.callbackPayload as any)?.gatewayTxnId ?? `mock_txn_${Date.now()}`,
        detail: 'mock success',
      };
    }
    if (outcome === 'cancel') {
      return { paid: false, failed: true, detail: 'mock cancel' };
    }
    return { paid: false, failed: true, detail: 'mock failure' };
  }
}
