import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Ferio Property Marketplace — Rent & Buy Apartments, Land & Commercial Properties in Dhaka",
  description: "Search apartments for rent, commercial shops, store rooms, and verified land sales in Dhaka with OpenStreetMap location coordinates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
