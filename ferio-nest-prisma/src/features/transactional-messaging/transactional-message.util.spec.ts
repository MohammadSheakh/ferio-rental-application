import {
  buildMessageDeduplicationKey,
  definitionForTemplateKey,
  maskMessageRecipient,
  renderMessageTemplate,
  templateForCommerceEvent,
  validateMessageTemplate,
} from './transactional-message.util';

describe('transactional message rules', () => {
  it('maps only approved commerce events to templates', () => {
    expect(templateForCommerceEvent('ORDER_PLACED')).toBe('order-placed');
    expect(templateForCommerceEvent('SHIPMENT_DELIVERED')).toBe(
      'shipment-delivered',
    );
    expect(templateForCommerceEvent('SHIPMENT_UNKNOWN')).toBeNull();
  });

  it('deduplicates the same occurrence without collapsing later events', () => {
    const first = buildMessageDeduplicationKey(
      'SHIPMENT_IN_TRANSIT',
      'Shipment',
      'shipment-1',
      'event-1',
    );
    expect(first).toBe(
      buildMessageDeduplicationKey(
        'SHIPMENT_IN_TRANSIT',
        'Shipment',
        'shipment-1',
        'event-1',
      ),
    );
    expect(first).not.toBe(
      buildMessageDeduplicationKey(
        'SHIPMENT_IN_TRANSIT',
        'Shipment',
        'shipment-1',
        'event-2',
      ),
    );
  });

  it('masks recipients in operational queue responses', () => {
    expect(maskMessageRecipient('+8801712345678')).toBe('+880*****678');
    expect(maskMessageRecipient('buyer@example.com')).toBe('bu***@example.com');
  });

  it('renders only event-specific allowlisted placeholders', () => {
    const definition = definitionForTemplateKey('order-placed');
    expect(definition).not.toBeNull();
    expect(
      validateMessageTemplate(
        'Order {{reference}} costs {{currency}} {{total}}.',
        definition!.allowedVariables,
      ),
    ).toBeNull();
    expect(
      renderMessageTemplate('Order {{reference}} costs {{total}}.', {
        reference: 'FER-42',
        total: 1250,
      }),
    ).toBe('Order FER-42 costs 1250.');
  });

  it('rejects unknown and malformed placeholders', () => {
    expect(
      validateMessageTemplate('Hello {{customerName}}', ['reference']),
    ).toBe('Unknown placeholder: customerName');
    expect(validateMessageTemplate('Order {{reference}', ['reference'])).toBe(
      'Template contains an invalid placeholder',
    );
  });
});
