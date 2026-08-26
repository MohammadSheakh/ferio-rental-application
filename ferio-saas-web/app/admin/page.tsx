import { FeatureStatusPage } from '@/components/FeatureStatusPage';

export default function PlatformAdminLinkPage() {
  return <FeatureStatusPage title="Platform administration" description="Platform staff operations are isolated from organization workspaces and run in the dedicated admin console." actionHref={process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3002'} actionLabel="Open admin console" />;
}
