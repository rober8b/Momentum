'use client';

import { useState, useTransition } from 'react';
import { Download, Loader2 } from 'lucide-react';

type ExportResult = {
  week: { start: string; end: string };
  counts: { workblocks: number; assignments: number; buildItems: number };
  summary: string;
  files: { path: string; content: string }[];
};

export function ExportButton() {
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function handleExport() {
    setBusy(true);
    startTransition(async () => {
      try {
        const res = await fetch('/api/export', { method: 'GET' });
        if (!res.ok) throw new Error(`Export failed: ${res.status}`);
        const data = (await res.json()) as ExportResult;
        triggerDownload(data);
      } catch (err) {
        console.error(err);
        alert('Export failed — ver consola.');
      } finally {
        setBusy(false);
      }
    });
  }

  function triggerDownload(data: ExportResult) {
    // Genera un único archivo .md con todos los exports concatenados.
    // V2: empaquetar como zip real con jszip.
    const parts: string[] = [
      '# command-center export',
      '',
      `Semana: ${data.week.start} → ${data.week.end}`,
      `Items: ${data.counts.workblocks + data.counts.assignments + data.counts.buildItems}`,
      '',
      '---',
      '',
      data.summary,
      '',
      '═════════════════════════════════════════════',
      '',
    ];
    for (const f of data.files) {
      parts.push(`## FILE: ${f.path}`, '', '```markdown', f.content, '```', '', '─────────────────────────────────────────', '');
    }
    const blob = new Blob([parts.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `command-center-${data.week.end}-export.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-colors disabled:opacity-50"
      title="Export weekly to vault"
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
      export
    </button>
  );
}
