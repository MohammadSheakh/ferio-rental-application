import { FeatureStatusPage } from '@/components/FeatureStatusPage';

export default function SearchPage() {
  return <FeatureStatusPage title="Marketplace search" description="Property discovery belongs to the public marketplace product and uses its dedicated PostGIS search experience." actionHref={process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? 'http://localhost:3001'} actionLabel="Open marketplace" />;
}
