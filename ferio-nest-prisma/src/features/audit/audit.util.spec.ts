import { safeAuditJson } from './audit.util';

describe('audit snapshots', () => {
  it('redacts secret-like keys recursively', () => {
    expect(
      safeAuditJson({
        name: 'Pathao',
        credentials: { apiKey: 'secret-value', token: 'token-value' },
      }),
    ).toEqual({
      name: 'Pathao',
      credentials: '[REDACTED]',
    });
  });

  it('keeps operational values and truncates oversized text', () => {
    const value = safeAuditJson({ status: 'CONFIRMED', note: 'x'.repeat(2100) });
    expect(value).toMatchObject({ status: 'CONFIRMED' });
    expect((value as { note: string }).note.length).toBe(2001);
  });
});
