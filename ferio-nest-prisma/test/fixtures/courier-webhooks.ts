export const courierWebhookSecrets = {
  pathao: 'pathao-integration-secret-20260813',
  steadfast: 'steadfast-integration-token-20260813',
};

export const pathaoWebhookHeaders = {
  valid: {
    'x-pathao-merchant-webhook-integration-secret':
      courierWebhookSecrets.pathao,
  },
  invalid: {
    'x-pathao-merchant-webhook-integration-secret': 'incorrect-pathao-secret',
  },
};

export const steadfastWebhookHeaders = {
  valid: { authorization: `Bearer ${courierWebhookSecrets.steadfast}` },
  invalid: { authorization: 'Bearer incorrect-steadfast-token' },
};

export function pathaoWebhookFixture(input: {
  eventId: string;
  consignmentId: string;
  event: string;
  occurredAt: string;
}) {
  return {
    event_id: input.eventId,
    consignment_id: input.consignmentId,
    merchant_order_id: `FERIO-${input.consignmentId}`,
    event: input.event,
    updated_at: input.occurredAt,
  };
}

export function steadfastWebhookFixture(input: {
  consignmentId: string;
  trackingCode: string;
  status: string;
  occurredAt: string;
}) {
  return {
    consignment_id: input.consignmentId,
    tracking_code: input.trackingCode,
    invoice: `FERIO-${input.consignmentId}`,
    status: input.status,
    updated_at: input.occurredAt,
  };
}
