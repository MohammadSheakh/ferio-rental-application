import {
  Body,
  NotFoundException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../identity/jwt-auth.guard';
import { Identity } from '../identity/identity.decorators';
import type { Identity as IdentityType } from '../identity/identity.decorators';
import {
  PaymentsService,
  type PaymentContext,
} from './payments.service';
import type { GatewayName } from './gateway.types';

class CreateIntentDto {
  @IsIn(['PLATFORM_INVOICE', 'LISTING_PROMOTION'])
  context!: PaymentContext;

  @IsString()
  refId!: string;

  @IsOptional()
  @IsIn(['bkash', 'sslcommerz', 'aamarpay', 'shurjopay', 'mock'])
  gateway?: GatewayName;

  @IsOptional()
  @IsObject()
  customer?: { name?: string; email?: string; phone?: string };
}

/**
 * § Week 27 — online payment checkout for Ferio's two payable flows.
 * Drivers: bkash · sslcommerz · aamarpay · shurjopay (+ mock for dev/E2E).
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('intents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create a gateway checkout (PLATFORM_INVOICE | LISTING_PROMOTION) → { intentId, paymentUrl }',
  })
  async create(
    @Identity() identity: IdentityType | null,
    @Body() dto: CreateIntentDto,
  ) {
    if (!identity?.userId) {
      return { success: false, statusCode: 401, message: 'Sign-in required' };
    }
    if (!dto?.context || !dto?.refId) {
      return { success: false, statusCode: 400, message: 'context and refId are required' };
    }
    const result = await this.payments.createIntent(identity, dto);
    return result;
  }

  @Get('intents/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Payment attempt status' })
  async status(@Param('id') id: string) {
    return this.payments.getStatus(id);
  }

  /** Gateways post IPN/callbacks here. Public by design — verified server-side. */
  @Post('callback/:gateway')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: `Gateway IPN endpoint (bkash|sslcommerz|aamarpay|shurjopay)` })
  async callback(
    @Param('gateway') gateway: GatewayName,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.payments.handleCallback(gateway, payload ?? {});
  }

  // ── Sandbox hosted page (mock driver only) ──

  @Get('sandbox/:intentId')
  @ApiOperation({ summary: 'Mock hosted checkout page (dev/E2E only — 404 in production)' })
  sandboxPage(@Param('intentId') intentId: string): string {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException('Not found');
    return [
      '<!doctype html><meta charset="utf-8">',
      `<title>Ferio Sandbox Checkout</title>`,
      `<body style="font-family:sans-serif;max-width:420px;margin:60px auto">`,
      `<h2>Sandbox Checkout</h2><p>Intent: <code>${intentId}</code></p>`,
      `<form method="POST" action="sandbox/${intentId}/confirm"><input name="outcome" value="success" hidden><button>Pay now</button></form>`,
      `<form method="POST" action="sandbox/${intentId}/confirm"><input name="outcome" value="fail" hidden><button>Simulate failure</button></form>`,
      `<form method="POST" action="sandbox/${intentId}/confirm"><input name="outcome" value="cancel" hidden><button>Cancel</button></form>`,
      `</body>`,
    ].join('\n');
  }

  @Post('sandbox/:intentId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sandbox decision → runs the normal verify+fulfill path' })
  async sandboxConfirm(
    @Param('intentId') intentId: string,
    @Body() body: { outcome?: string },
  ) {
    if (process.env.NODE_ENV === 'production') throw new NotFoundException('Not found');
    const outcome = (
      ['success', 'fail', 'cancel'].includes(body?.outcome ?? '') ? body.outcome : 'success'
    ) as 'success' | 'fail' | 'cancel';
    return this.payments.sandboxDecide(intentId, outcome);
  }
}
