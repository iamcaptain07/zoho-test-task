import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zoho CSV Importer',
  description: 'Import customers and contracts to Zoho CRM',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

