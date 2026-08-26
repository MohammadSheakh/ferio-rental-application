import Link from 'next/link';
import { Header } from './Header';

export function FeatureStatusPage({
  title,
  description,
  actionHref = '/',
  actionLabel = 'Return to overview',
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return <div>
    <Header title={title} subtitle="Workflow status" />
    <div className="p-5 sm:p-8">
      <section className="max-w-2xl rounded-[10px] border border-[#e8e8ea] p-8">
        <p className="text-sm leading-6 text-[#6e6e73]">{description}</p>
        <Link href={actionHref} className="btn-pill-primary mt-6 inline-flex px-5 py-2 text-xs">{actionLabel}</Link>
      </section>
    </div>
  </div>;
}
