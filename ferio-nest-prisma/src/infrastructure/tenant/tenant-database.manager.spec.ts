import { TenantDatabaseManager } from './tenant-database.manager';

describe('TenantDatabaseManager', () => {
  const originalPassword = process.env.ORG_ALPHA_DB_PASSWORD;

  afterEach(() => {
    if (originalPassword === undefined) delete process.env.ORG_ALPHA_DB_PASSWORD;
    else process.env.ORG_ALPHA_DB_PASSWORD = originalPassword;
    jest.restoreAllMocks();
  });

  it('uses TenantDatabase.passwordRef on the primary organization path', async () => {
    process.env.ORG_ALPHA_DB_PASSWORD = 'alpha secret';
    const controlPlane = {
      tenantDatabase: {
        findUnique: jest.fn().mockResolvedValue({
          organizationId: 'org-alpha',
          status: 'READY',
          host: 'db.internal',
          port: 5432,
          username: 'ferio_alpha',
          databaseName: 'tenant_alpha',
          sslMode: 'require',
          passwordRef: 'env:ORG_ALPHA_DB_PASSWORD',
        }),
      },
    };
    const manager = new TenantDatabaseManager(controlPlane as never);
    const getClient = jest
      .spyOn(manager, 'getClient')
      .mockResolvedValue({} as never);

    await manager.getTenantDatabase('org-alpha');

    expect(getClient).toHaveBeenCalledWith(
      'org-alpha',
      'postgresql://ferio_alpha:alpha%20secret@db.internal:5432/tenant_alpha?sslmode=require',
    );
    await manager.onModuleDestroy();
  });
});
