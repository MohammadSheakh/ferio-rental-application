import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ferio Control Plane — Platform Admin Console (admin.ferio.com)",
  description: "SaaS Multi-Tenant Provisioning, Plan Entitlements & Marketplace Moderation Control Panel",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
