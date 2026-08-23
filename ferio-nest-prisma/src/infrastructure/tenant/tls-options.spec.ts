import { tlsOptionsFromUrl } from './tls-options';

describe('tlsOptionsFromUrl', () => {
  it('strips sslmode and disables TLS for local/dev modes', () => {
    const out = tlsOptionsFromUrl(
      'postgresql://u:p@localhost:5432/tenant_x?sslmode=prefer',
    );
    expect(out.connectionString).toBe(
      'postgresql://u:p@localhost:5432/tenant_x',
    );
    expect(out.ssl).toBeUndefined();
  });

  it('maps require → TLS without CA verification', () => {
    const out = tlsOptionsFromUrl(
      'postgresql://u:p@db.example.com:5432/t?sslmode=require',
    );
    expect(out.ssl).toBe(true);
  });

  it('absent sslmode → no TLS', () => {
    const out = tlsOptionsFromUrl('postgresql://u:p@localhost:5432/t');
    expect(out.ssl).toBeUndefined();
    expect(out.connectionString).not.toContain('sslmode');
  });

  it('preserves unrelated query params', () => {
    const out = tlsOptionsFromUrl(
      'postgresql://u:p@h:5432/t?sslmode=disable&application_name=ferio',
    );
    expect(out.connectionString).toContain('application_name=ferio');
  });
});
