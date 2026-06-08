// Serializa items completados de la última semana a markdown con el formato del vault.
// El endpoint /api/export usa esto y devuelve un ZIP en el response.

import type { Workblock, Assignment, BuildItem, Subject } from './types';

function isoWeek(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fm(fields: Record<string, string>): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return ['---', ...lines, '---'].join('\n');
}

export type ExportPayload = {
  workblocks: Workblock[];
  assignments: (Assignment & { subjectSlug: string | null })[];
  buildItems: BuildItem[];
  subjects: Subject[];
  weekStart: string;
  weekEnd: string;
};

export type ExportFile = {
  path: string;       // relative to vault root
  content: string;
};

export function buildExportFiles(payload: ExportPayload): ExportFile[] {
  const files: ExportFile[] = [];
  const weekISO = isoWeek(new Date(payload.weekEnd));

  // ----- WORK — un archivo por semana -----
  if (payload.workblocks.length > 0) {
    const path = `work/sessions/${weekISO}-week.md`;
    const content = [
      fm({
        type: 'work-log',
        status: 'active',
        tags: '[work, weekly]',
        created: weekISO,
        week_start: payload.weekStart,
        week_end: payload.weekEnd,
        lang: 'en',
      }),
      '',
      `# Work — week ${payload.weekStart} → ${payload.weekEnd}`,
      '',
      `## Completed workblocks (${payload.workblocks.length})`,
      '',
      '| Type | Title | Priority | Completed |',
      '|------|-------|----------|-----------|',
      ...payload.workblocks.map((w) => {
        const completed = w.completed_at ? w.completed_at.slice(0, 10) : '';
        return `| ${w.type} | ${w.title.replace(/\|/g, '\\|')} | ${w.priority} | ${completed} |`;
      }),
      '',
      ...payload.workblocks
        .filter((w) => w.notes || w.description)
        .flatMap((w) => [
          `### ${w.title}`,
          '',
          w.description ?? '',
          w.notes ? `\n**Notes:**\n${w.notes}` : '',
          '',
        ]),
      '',
    ].join('\n');
    files.push({ path, content });
  }

  // ----- ASSIGNMENTS — un append por materia -----
  const bySubject = new Map<string, typeof payload.assignments>();
  for (const a of payload.assignments) {
    if (!a.subjectSlug) continue;
    const arr = bySubject.get(a.subjectSlug) ?? [];
    arr.push(a);
    bySubject.set(a.subjectSlug, arr);
  }
  for (const [slug, items] of bySubject) {
    const path = `studies/${slug}/log.md`;
    const content = [
      fm({
        type: 'study-log',
        status: 'active',
        subject: slug,
        tags: '[study, weekly]',
        updated: weekISO,
        lang: 'en',
      }),
      '',
      `# ${slug} — log`,
      '',
      `## Week ${payload.weekStart} → ${payload.weekEnd}`,
      '',
      '| Title | Completed |',
      '|-------|-----------|',
      ...items.map((a) => {
        const completed = a.completed_at ? a.completed_at.slice(0, 10) : '';
        return `| ${a.title.replace(/\|/g, '\\|')} | ${completed} |`;
      }),
      '',
    ].join('\n');
    files.push({ path, content });
  }

  // ----- BUILD — un archivo semanal -----
  if (payload.buildItems.length > 0) {
    const path = `build/${weekISO}-week.md`;
    const content = [
      fm({
        type: 'build-log',
        status: 'active',
        tags: '[build-in-public, weekly]',
        created: weekISO,
        week_start: payload.weekStart,
        week_end: payload.weekEnd,
        lang: 'en',
      }),
      '',
      `# Build-in-public — week ${payload.weekStart} → ${payload.weekEnd}`,
      '',
      `## Published (${payload.buildItems.length})`,
      '',
      ...payload.buildItems.flatMap((b) => {
        const lines = [
          `### ${b.title}`,
          '',
          `- **Type:** ${b.type}`,
          `- **Platforms:** ${b.platforms.join(', ')}`,
          `- **Published:** ${b.published_at ? b.published_at.slice(0, 10) : ''}`,
        ];
        if (b.related_project) lines.push(`- **Related:** ${b.related_project}`);
        if (Object.keys(b.links).length > 0) {
          lines.push('- **Links:**');
          for (const [k, v] of Object.entries(b.links)) lines.push(`  - ${k}: ${v}`);
        }
        if (b.hook) lines.push('', `**Hook:** ${b.hook}`);
        if (b.draft) lines.push('', '**Content:**', '', b.draft);
        lines.push('');
        return lines;
      }),
    ].join('\n');
    files.push({ path, content });
  }

  return files;
}

export function summaryLog(payload: ExportPayload, files: ExportFile[]): string {
  return [
    `# Export ${payload.weekStart} → ${payload.weekEnd}`,
    '',
    `Files generated: ${files.length}`,
    '',
    ...files.map((f) => `- \`${f.path}\``),
    '',
    `Workblocks: ${payload.workblocks.length}`,
    `Assignments: ${payload.assignments.length}`,
    `Build items: ${payload.buildItems.length}`,
    '',
  ].join('\n');
}
