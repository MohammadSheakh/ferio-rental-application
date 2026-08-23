import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Ferio Rental — Property & Lease Operations Platform',
  description: ' बांग्लादेश Market Optimized Property Management, Automated Financial Ledgers & Tenant Operations',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-white text-[#111114]">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 bg-white min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
