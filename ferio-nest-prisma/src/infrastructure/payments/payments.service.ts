import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
void [NotFoundException, BadRequestException, ForbiddenException];
import { randomBytes } from 'crypto';
import {
  ControlPlanePrismaService,
} from '../control-plane/control-plane-prisma.service';
import { MarketplacePrismaService } from '../marketplace/marketplace-prisma.service';
import { TenantDatabaseManager } from '../tenant/tenant-database.manager';
import { PlatformBillingService } from '../billing/platform-billing.service';
import { PromotionService } from '../../features/marketplace/promotion.service';
import {
  GatewayConfigError,
  type GatewayName,
  type PaymentGatewayDriver,
} from './gateway.types';
import { BkashGateway } from './gateways/bkash.gateway';
import { SslCommerzGateway } from './gateways/sslcommerz.gateway';
import { AamarPayGateway } from './gateways/aamarpay.gateway';
import { ShurjoPayGateway } from './gateways/shurjopay.gateway';
import { MockGateway } from './gateways/mock.gateway';

export type PaymentContext = 'PLATFORM_INVOICE' | 'LISTING_PROMOTION';

const GATEWAYS: Record<GatewayName, () => PaymentGatewayDriver> = {
  bkash: () => new BkashGateway(),
  sslcommerz: () => new SslCommerzGateway(),
  aamarpay: () => new AamarPayGateway(),
  shurjopay: () => new ShurjoPayGateway(),
  mock: () => new MockGateway(),
};

/**
 * § Week 27 — Bangladesh payment-gateway layer.
 *
 * Owns PaymentIntent persistence + driver dispatch + fulfillment into
 * the two payable money flows:
 *   PLATFORM_INVOICE → PlatformBillingService.recordPayment
 *   LISTING_PROMOTION → PromotionService.confirmPayment
 *
 * Fulfillment is exactly-once per intent (status guard + fulfilledAt).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly drivers = new Map<GatewayName, PaymentGatewayDriver>();

  constructor(
    private readonly controlPlane: ControlPlanePrismaService,
    private readonly marketplacePrisma: MarketplacePrismaService,
    private readonly tenantDbManager: TenantDatabaseManager,
    private readonly platformBilling: PlatformBillingService,
    private readonly promotions: PromotionService,
  ) {}

  private driver(name: GatewayName): PaymentGatewayDriver {
    let d = this.drivers.get(name);
    if (!d) {
      d = GATEWAYS[name]();
      this.drivers.set(name, d);
    }
    return d;
  }

  availableGateways() {
    const names = Object.keys(GATEWAYS) as GatewayName[];
    return names.map((name) => {
      const d = this.driver(name);
      return { gateway: name, available: d.configured };
    });
  }

  private baseUrl(): string {
    return (
      process.env.PAYMENTS_PUBLIC_URL ??
      `http://localhost:${process.env.PORT ?? 6733}/api/v1/payments`
    );
  }

  /**
   * Create (or reuse a PENDING) checkout for a payable object after
   * verifying the caller owns it. Returns the hosted-page URL.
   */
  async createIntent(
    identity: { userId: string },
    input: { context: PaymentContext; refId: string; gateway?: GatewayName },
  ): Promise<{ intentId: string; paymentUrl: string; amountBdt: number; gateway: string; reused: boolean }> {
    const gatewayName: GatewayName =
      input.gateway ?? (process.env.PAYMENT_GATEWAY_DRIVER as GatewayName) ?? 'mock';
    if (!GATEWAYS[gatewayName]) {
      throw new BadRequestException(`Unknown gateway "${gatewayName}"`);
    }
    const driver = this.driver(gatewayName);

    // Reuse an open PENDING attempt for the same object + gateway.
    const existing = await this.controlPlane.paymentIntent.findFirst({
      where: { context: input.context, refId: input.refId, gateway: gatewayName, status: 'PENDING' },
    });
    if (existing && driver.configured && gatewayName !== 'mock') {
      // We cannot reconstruct the hosted URL without calling initiate again;
      // simplest correct behaviour: cancel stale and fall through to fresh.
      await this.controlPlane.paymentIntent.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED' },
      });
    }

    let organizationId: string | null = null;
    let amountBdt: number;
    let description: string;

    if (input.context === 'PLATFORM_INVOICE') {
      const invoice = await this.controlPlane.platformInvoice.findUnique({
        where: { id: input.refId },
        include: { payments: true, organization: { select: { slug: true, name: true } } },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      await this.assertOrgOwner(identity.userId, invoice.organizationId);
      const paidSoFar = invoice.payments.reduce((s2, p) => s2 + p.amountBdt, 0);
      amountBdt = Math.round((invoice.amountBdt - paidSoFar) * 100) / 100;
      if (amountBdt <= 0) {
        throw new BadRequestException('Invoice has no outstanding balance');
      }
      organizationId = invoice.organizationId;
      description = `Ferio subscription ${invoice.periodKey}`;
    } else if (input.context === 'LISTING_PROMOTION') {
      const promo = await this.marketplacePrisma.listingPromotion.findUnique({
        where: { id: input.refId },
        include: { listing: { select: { title: true, seller: { select: { centralUserId: true } } } } },
      });
      if (!promo) throw new NotFoundException('Promotion not found');
      if (promo.listing.seller.centralUserId !== identity.userId) {
        throw new ForbiddenException('You do not own this promotion');
      }
      if (promo.status !== 'PENDING_PAYMENT') {
        throw new BadRequestException(
          `Only PENDING_PAYMENT promotions can be paid online (current: ${promo.status})`,
        );
      }
      amountBdt = promo.amountBdt;
      description = `Ferio ${promo.type} promotion`;
    } else {
      throw new BadRequestException(`Unknown payment context "${input.context}"`);
    }

    const initiated = await driver.initiate({
      intentId: `${input.refId}:${randomBytes(4).toString('hex')}`,
      amountBdt,
      description,
      customer: {},
      successUrl: `${this.baseUrl()}/return`,
      failureUrl: `${this.baseUrl()}/return`,
      cancelUrl: `${this.baseUrl()}/return`,
    }).catch((err) => {
      if (err instanceof GatewayConfigError) throw new BadRequestException(err.message);
      throw err;
    });

    // The driver received a decorated intentId; store the real refId row.
    const realIntentRef = initiated.gatewayRef.includes(':')
      ? undefined
      : initiated.gatewayRef;

    const intent = await this.controlPlane.paymentIntent.create({
      data: {
        context: input.context,
        refId: input.refId,
        organizationId,
        gateway: gatewayName,
        gatewayRef: initiated.gatewayRef,
        amountBdt,
        payerUserId: identity.userId,
        status: 'PENDING',
      },
    });
    void realIntentRef;

    this.logger.log(
      `💳 intent ${intent.id} (${input.context}/${gatewayName}) ৳${amountBdt} → ${initiated.paymentUrl.slice(0, 60)}…`,
    );
    return {
      intentId: intent.id,
      paymentUrl: initiated.paymentUrl,
      amountBdt,
      gateway: gatewayName,
      reused: false,
    };
  }

  /** Caller must be an ACTIVE ORGANIZATION_OWNER of the org. */
  private async assertOrgOwner(centralUserId: string, organizationId: string) {
    const db = await this.tenantDbManager.getTenantDatabase(organizationId).catch(() => null);
    if (!db) throw new ForbiddenException('Workspace unavailable');
    const member = await db.member.findFirst({
      where: { centralUserId },
      select: { role: true, status: true },
    });
    if (!member || member.status !== 'ACTIVE' || member.role !== 'ORGANIZATION_OWNER') {
      throw new ForbiddenException('Only the workspace owner can pay this invoice');
    }
  }

  async getStatus(intentId: string) {
    const intent = await this.controlPlane.paymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) throw new NotFoundException('Payment intent not found');
    return intent;
  }

  /**
   * Server-to-server entry: resolve the intent from the callback payload,
   * run the driver verification, then fulfill exactly-once.
   */
  async handleCallback(
    gateway: GatewayName,
    payload: Record<string, unknown>,
  ): Promise<{ intentId: string; status: string; detail?: string }> {
    // Our controllers embed the Ferio intentId as tran_id/merchantInvoiceNumber;
    // gateways echo it back on callbacks.
    const echoed =
      (payload.tran_id as string) ??
      (payload.merchantInvoiceNumber as string) ??
      ((payload.order_id as string) ? undefined : undefined);

    let intent = echoed
      ? await this.controlPlane.paymentIntent.findFirst({
          where: { refId: echoed, gateway, status: 'PENDING' },
        })
      : null;

    if (!intent) {
      // Fall back: newest PENDING intent for this gateway whose gatewayRef matches.
      const gref = (payload.paymentID as string) ?? (payload.sessionkey as string);
      intent = await this.controlPlane.paymentIntent.findFirst({
        where: {
          gateway,
          status: 'PENDING',
          ...(gref ? { gatewayRef: gref } : {}),
        },
      });
    }
    if (!intent) throw new NotFoundException('No matching PENDING payment intent');

    const driver = this.driver(gateway);
    const result = await driver.verify({
      gatewayRef: intent.gatewayRef ?? '',
      intentId: intent.refId,
      amountBdt: intent.amountBdt,
      callbackPayload: payload,
    });

    if (result.paid) {
      await this.markPaid(intent.id, result.gatewayTxnId ?? '', result.detail ?? '');
    } else if (result.failed) {
      await this.controlPlane.paymentIntent.update({
        where: { id: intent.id },
        data: { status: 'FAILED', failureReason: result.detail ?? 'failed at gateway' },
      });
    }
    const after = await this.getStatus(intent.id);
    return { intentId: intent.id, status: after.status, detail: result.detail };
  }

  /** Sandbox helper: drive the mock driver like a real callback would. */
  async sandboxDecide(intentId: string, outcome: 'success' | 'fail' | 'cancel') {
    const intent = await this.controlPlane.paymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) throw new NotFoundException('Payment intent not found');
    if (intent.gateway !== 'mock') {
      throw new BadRequestException('Sandbox decisions apply to mock intents only');
    }
    if (intent.status !== 'PENDING') {
      throw new BadRequestException(`Intent already ${intent.status}`);
    }
    return this.handleCallback('mock', { sandbox: outcome, order_id: intent.refId });
  }

  /**
   * § P1 hardening — exactly-once fulfillment, but honest about failure:
   * the intent is only marked PAID+fulfilled AFTER the domain side
   * succeeds. On failure it stays `PAID` with `fulfilledAt=null` so the
   * retry scan (and POST /platform/payments/:id/refulfill) can complete it.
   */
  private async markPaid(intentId: string, gatewayTxnId: string, detail: string) {
    const intent = await this.controlPlane.paymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent || (intent.status === 'PAID' && intent.fulfilledAt)) return;

    const reference = `${intent.gateway}:${gatewayTxnId}`;
    try {
      if (intent.context === 'PLATFORM_INVOICE') {
        await this.platformBilling.recordPayment(
          intent.refId,
          { method: 'GATEWAY', amountBdt: intent.amountBdt, reference },
          'system:gateway',
        );
      } else if (intent.context === 'LISTING_PROMOTION') {
        await this.promotions.confirmPayment(
          intent.refId,
          'system:gateway',
          { paidVia: 'GATEWAY', paymentReference: reference } as any,
        );
      }
      await this.controlPlane.paymentIntent.update({
        where: { id: intentId },
        data: { status: 'PAID', fulfilledAt: new Date(), failureReason: null },
      });
      this.logger.log(`✅ fulfilled ${intent.context}/${intent.refId} via ${reference}`);
    } catch (err) {
      // Money captured but benefit not granted → stays visible for retry.
      await this.controlPlane.paymentIntent.update({
        where: { id: intentId },
        data: { status: 'PAID', failureReason: `FULFILLMENT_FAILED: ${String(err instanceof Error ? err.message : err).slice(0, 200)}` },
      });
      this.logger.error(
        `⚠️ FULFILLMENT FAILED for intent ${intentId} (retryable): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /** § P1: sweep PAID intents that never got fulfilled and complete them. */
  async refulfillPending() {
    const stuck = await this.controlPlane.paymentIntent.findMany({
      where: { status: 'PAID', fulfilledAt: null },
      take: 100,
    });
    let completed = 0;
    for (const intent of stuck) {
      try {
        const txn = String(intent.gatewayRef ?? '');
        await this.markPaid(intent.id, txn.includes(':') ? txn.split(':')[1] : txn, 'retry');
        if ((await this.controlPlane.paymentIntent.findUnique({ where: { id: intent.id }, select: { fulfilledAt: true } }))?.fulfilledAt) {
          completed++;
        }
      } catch {
        /* next sweep retries */
      }
    }
    return { stuck: stuck.length, completed };
  }
}
