import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'command center — rober',
  description: 'Personal daily dashboard: uni · aleph · build-in-public',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}
