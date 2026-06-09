'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/lib/hooks/useToast';
import { updateUserProfile } from '@/app/settings/profile/actions';
import type { User } from '@/lib/types';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/Mexico_City',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

export function ProfileForm({ user }: { user: User }) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [displayName, setDisplayName] = useState(user.display_name ?? '');
  const [timezone, setTimezone] = useState(user.settings.timezone);
  const [language, setLanguage] = useState<'en' | 'es'>(user.settings.language);
  const [vaultPath, setVaultPath] = useState(user.settings.vault_path);
  const [exportEnabled, setExportEnabled] = useState(user.settings.export_enabled);

  function save() {
    startTransition(async () => {
      await updateUserProfile({
        display_name: displayName,
        settings: { timezone, language, vault_path: vaultPath, export_enabled: exportEnabled },
      });
      toast.success('preferencias guardadas');
    });
  }

  const labelCls = 'block text-[10px] uppercase tracking-wider text-muted-foreground mb-1';
  const inputCls =
    'w-full rounded-sm border border-border bg-surface px-2 py-1.5 text-sm focus:outline-none focus:border-accent';

  return (
    <div className="space-y-6">
      {/* Account info */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
          cuenta
        </h2>

        <div>
          <label className={labelCls}>email</label>
          <input
            type="email"
            value={user.email}
            disabled
            className={`${inputCls} opacity-50 cursor-not-allowed`}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            el email no se puede cambiar desde la UI en esta versión.
          </p>
        </div>

        <div>
          <label className={labelCls}>nombre de display</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Tu nombre"
            className={inputCls}
          />
        </div>
      </section>

      {/* Preferences */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
          preferencias
        </h2>

        <div>
          <label className={labelCls}>timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className={inputCls}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>idioma</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
            className={inputCls}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </div>
      </section>

      {/* Vault integration */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground border-b border-border pb-2">
          vault de obsidian
        </h2>

        <div>
          <label className={labelCls}>vault path (prefijo de export)</label>
          <input
            type="text"
            value={vaultPath}
            onChange={(e) => setVaultPath(e.target.value)}
            placeholder="30-personal/momentum"
            className={inputCls}
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            prefijo para los archivos generados por el export semanal. si está vacío se usa{' '}
            <code className="font-mono">momentum-export/</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={exportEnabled}
            onClick={() => setExportEnabled((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              exportEnabled ? 'bg-accent' : 'bg-muted'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                exportEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <div>
            <p className="text-sm text-foreground">export semanal</p>
            <p className="text-[10px] text-muted-foreground">
              incluirme en el cron de export de los domingos.
            </p>
          </div>
        </div>
      </section>

      <Button
        type="button"
        onClick={save}
        disabled={isPending || !displayName.trim()}
      >
        {isPending ? 'guardando…' : 'guardar cambios'}
      </Button>
    </div>
  );
}
