import Link from 'next/link';
import { cn } from '@/lib/cn';
import { t, type Lang } from '@/lib/strings';
import { GithubIcon, GoogleIcon } from './OAuthIcons';

const oauthButtonClass = cn(
  'inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-elev px-4 h-9 text-sm font-medium text-foreground transition-colors hover:bg-muted',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background',
);

type Props = {
  providers: { github: boolean; google: boolean };
  next: string;
  lang: Lang;
};

export function OAuthButtons({ providers, next, lang }: Props) {
  if (!providers.github && !providers.google) return null;

  const nextParam = `?next=${encodeURIComponent(next)}`;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {providers.github && (
          <Link href={`/api/auth/github${nextParam}`} className={oauthButtonClass}>
            <GithubIcon className="h-4 w-4" />
            {t('authContinueWithGithub', lang)}
          </Link>
        )}
        {providers.google && (
          <Link href={`/api/auth/google${nextParam}`} className={oauthButtonClass}>
            <GoogleIcon className="h-4 w-4" />
            {t('authContinueWithGoogle', lang)}
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>{t('authOrDivider', lang)}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
