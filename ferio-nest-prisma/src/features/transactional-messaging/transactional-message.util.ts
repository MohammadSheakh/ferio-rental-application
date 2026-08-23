import { createHash } from 'crypto';

export type CommerceTemplateDefinition = {
  eventType: string;
  key: string;
  subjectTemplate: string;
  bodyTemplate: string;
  allowedVariables: string[];
};

export const commerceTemplateDefinitions: CommerceTemplateDefinition[] = [
  {
    eventType: 'ORDER_PLACED',
    key: 'order-placed',
    subjectTemplate: 'Order {{reference}} received',
    bodyTemplate:
      'We received order {{reference}}. Total: {{currency}} {{total}}.',
    allowedVariables: ['reference', 'status', 'total', 'currency'],
  },
  {
    eventType: 'ORDER_CONFIRMED',
    key: 'order-confirmed',
    subjectTemplate: 'Order {{reference}} confirmed',
    bodyTemplate: 'Order {{reference}} is confirmed and is being prepared.',
    allowedVariables: ['reference', 'status', 'total', 'currency'],
  },
  {
    eventType: 'ORDER_CANCELLED',
    key: 'order-cancelled',
    subjectTemplate: 'Order {{reference}} cancelled',
    bodyTemplate: 'Order {{reference}} has been cancelled.',
    allowedVariables: ['reference', 'status', 'total', 'currency'],
  },
  {
    eventType: 'SHIPMENT_CREATED',
    key: 'shipment-created',
    subjectTemplate: 'Shipment created for {{orderReference}}',
    bodyTemplate:
      'Shipment {{trackingNumber}} for order {{orderReference}} was created with {{provider}}.',
    allowedVariables: [
      'orderReference',
      'trackingNumber',
      'trackingUrl',
      'provider',
    ],
  },
  {
    eventType: 'SHIPMENT_PICKED_UP',
    key: 'shipment-picked-up',
    subjectTemplate: 'Order {{orderReference}} picked up',
    bodyTemplate:
      'Shipment {{trackingNumber}} for order {{orderReference}} has been picked up.',
    allowedVariables: ['orderReference', 'shipmentStatus', 'trackingNumber'],
  },
  {
    eventType: 'SHIPMENT_IN_TRANSIT',
    key: 'shipment-in-transit',
    subjectTemplate: 'Order {{orderReference}} is in transit',
    bodyTemplate:
      'Shipment {{trackingNumber}} for order {{orderReference}} is in transit.',
    allowedVariables: ['orderReference', 'shipmentStatus', 'trackingNumber'],
  },
  {
    eventType: 'SHIPMENT_OUT_FOR_DELIVERY',
    key: 'shipment-out-for-delivery',
    subjectTemplate: 'Order {{orderReference}} is out for delivery',
    bodyTemplate:
      'Shipment {{trackingNumber}} for order {{orderReference}} is out for delivery.',
    allowedVariables: ['orderReference', 'shipmentStatus', 'trackingNumber'],
  },
  {
    eventType: 'SHIPMENT_DELIVERED',
    key: 'shipment-delivered',
    subjectTemplate: 'Order {{orderReference}} delivered',
    bodyTemplate:
      'Shipment {{trackingNumber}} for order {{orderReference}} has been delivered.',
    allowedVariables: ['orderReference', 'shipmentStatus', 'trackingNumber'],
  },
  {
    eventType: 'SHIPMENT_DELIVERY_FAILED',
    key: 'shipment-delivery-failed',
    subjectTemplate: 'Delivery update for {{orderReference}}',
    bodyTemplate:
      'Delivery of shipment {{trackingNumber}} for order {{orderReference}} was unsuccessful.',
    allowedVariables: ['orderReference', 'shipmentStatus', 'trackingNumber'],
  },
  {
    eventType: 'SHIPMENT_RETURN_IN_PROGRESS',
    key: 'shipment-return-in-progress',
    subjectTemplate: 'Return started for {{orderReference}}',
    bodyTemplate:
      'Shipment {{trackingNumber}} for order {{orderReference}} is returning to the store.',
    allowedVariables: ['orderReference', 'shipmentStatus', 'trackingNumber'],
  },
  {
    eventType: 'SHIPMENT_RETURNED',
    key: 'shipment-returned',
    subjectTemplate: 'Order {{orderReference}} returned',
    bodyTemplate:
      'Shipment {{trackingNumber}} for order {{orderReference}} has returned to the store.',
    allowedVariables: ['orderReference', 'shipmentStatus', 'trackingNumber'],
  },
  {
    eventType: 'SHIPMENT_CANCELLED',
    key: 'shipment-cancelled',
    subjectTemplate: 'Shipment cancelled for {{orderReference}}',
    bodyTemplate:
      'Shipment {{trackingNumber}} for order {{orderReference}} has been cancelled.',
    allowedVariables: ['orderReference', 'shipmentStatus', 'trackingNumber'],
  },
];

const templates = Object.fromEntries(
  commerceTemplateDefinitions.map((definition) => [
    definition.eventType,
    definition.key,
  ]),
);

export function templateForCommerceEvent(eventType: string): string | null {
  return templates[eventType] ?? null;
}

export function definitionForTemplateKey(key: string) {
  return (
    commerceTemplateDefinitions.find((definition) => definition.key === key) ??
    null
  );
}

export function templateVariables(template: string): string[] {
  return [...template.matchAll(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g)].map(
    (match) => match[1],
  );
}

export function validateMessageTemplate(
  template: string,
  allowedVariables: string[],
) {
  const withoutTokens = template.replace(
    /{{\s*[A-Za-z][A-Za-z0-9_]*\s*}}/g,
    '',
  );
  if (withoutTokens.includes('{{') || withoutTokens.includes('}}')) {
    return 'Template contains an invalid placeholder';
  }
  const unknown = templateVariables(template).filter(
    (variable) => !allowedVariables.includes(variable),
  );
  return unknown.length > 0
    ? `Unknown placeholder${unknown.length === 1 ? '' : 's'}: ${[...new Set(unknown)].join(', ')}`
    : null;
}

export function renderMessageTemplate(
  template: string,
  payload: Record<string, unknown>,
): string {
  return template.replace(
    /{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g,
    (_token, variable: string) => {
      const value = payload[variable];
      return value === null || value === undefined ? '' : String(value);
    },
  );
}

export function buildMessageDeduplicationKey(
  eventType: string,
  referenceType: string,
  referenceId: string,
  occurrenceKey?: string,
): string {
  return createHash('sha256')
    .update(
      [eventType, referenceType, referenceId, occurrenceKey ?? 'once'].join(
        ':',
      ),
    )
    .digest('hex');
}

export function maskMessageRecipient(recipient: string): string {
  if (recipient.includes('@')) {
    const [name, domain] = recipient.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return recipient.length > 6
    ? `${recipient.slice(0, 4)}*****${recipient.slice(-3)}`
    : '***';
}
