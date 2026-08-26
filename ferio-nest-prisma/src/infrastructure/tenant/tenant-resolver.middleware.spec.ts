import { TenantResolverMiddleware } from './tenant-resolver.middleware';

describe('TenantResolverMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('ignores X-Tenant-Slug in production', async () => {
    process.env.NODE_ENV = 'production';
    const controlPlane = {
      saasOrganization: { findUnique: jest.fn() },
      organizationDomain: { findUnique: jest.fn() },
    };
    const cache = {
      getContext: jest.fn(),
      getDomain: jest.fn(),
    };
    const middleware = new TenantResolverMiddleware(
      controlPlane as never,
      cache as never,
    );
    const request = {
      headers: { 'x-tenant-slug': 'victim-org', host: 'api.ferio.com' },
    } as any;
    const next = jest.fn();

    await middleware.use(request, {} as any, next);

    expect(request.tenantContext).toBeUndefined();
    expect(controlPlane.saasOrganization.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });
});
