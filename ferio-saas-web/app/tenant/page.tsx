import { FeatureStatusPage } from '@/components/FeatureStatusPage';

export default function RenterPortalLinkPage() {
  const marketplace = process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? 'http://localhost:3001';
  return <FeatureStatusPage title="Renter portal" description="Renters use the marketplace identity and renter portal rather than the organization operations console." actionHref={`${marketplace}/renter`} actionLabel="Open renter portal" />;
}
