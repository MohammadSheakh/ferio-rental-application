import { ControlPlanePrismaService } from '../src/infrastructure/control-plane/control-plane-prisma.service';
import { TenantDatabaseManager } from '../src/infrastructure/tenant/tenant-database.manager';
import { TenantPropertyService } from '../src/features/tenant-operations/tenant-property.service';
import { EntitlementService } from '../src/infrastructure/entitlements/entitlement.service';
import { filterByScope, isScoped } from '../src/features/tenant-operations/member-scope';

async function main() {
  const control = new ControlPlanePrismaService();
  await control.onModuleInit();
  const tdm = new TenantDatabaseManager(control);
  const org = await control.saasOrganization.findUniqueOrThrow({
    where: { slug: 'sheakh-fam' }, select: { id: true },
  });
  const db = await tdm.getTenantDatabase(org.id);
  const member = await db.member.findFirst({ where: { role: 'VIEWER' } });
  console.log('member:', member?.displayName, '| scopes:', JSON.stringify(member?.scopePropertyIds));

  const svc = new TenantPropertyService(tdm, new EntitlementService(control));
  const props = await svc.listProperties(org.id);
  console.log('all props:', props.map((p) => `${p.id.slice(-6)}:${p.name}`));
  console.log('isScoped:', isScoped(member!));
  const filtered = filterByScope(member!, props);
  console.log('filtered:', filtered.map((p) => p.name));

  await tdm.onModuleDestroy();
  await control.$disconnect();
}
main();
