import type { Metadata } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'command center — rober',
  description: 'Personal daily dashboard: uni · aleph · build-in-public',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ToastProvider>
          <AppShell isAuthenticated={!!user}>{children}</AppShell>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
