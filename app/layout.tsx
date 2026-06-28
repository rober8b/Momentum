import type { Metadata } from 'next';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/react';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});
import AppShell from '@/components/AppShell';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { WelcomeModal } from '@/components/onboarding/WelcomeModal';
import { getCurrentUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'momentum',
  description: 'The organization platform for builders',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="es" className={`dark ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ToastProvider>
          <AppShell
            isAuthenticated={!!user}
            isAdmin={user?.role === 'admin'}
            userLabel={user?.display_name || user?.email || undefined}
          >
            {children}
          </AppShell>
          {user && !user.settings.onboarding_completed && (
            <WelcomeModal lang={user.settings.language} />
          )}
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
