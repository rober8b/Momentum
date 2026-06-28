// Pure, deterministic function. No side effects, no DB calls.
// Converts OnboardingAnswers → ProposedStructure for the preview step.

import { FREE_LEAF_ITEM_LIMIT } from '@/lib/plans';
import type {
  OnboardingAnswers,
  OnboardingContext,
  ProposedItem,
  ProposedPillar,
  ProposedStructure,
} from './types';

// ---------- helpers ----------

function currentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-based
  const half = month <= 6 ? 1 : 2;
  return `${year}-${half}`;
}

function leaf(title: string, status: string, fields: Record<string, unknown>): ProposedItem {
  return { title, status, fields, is_container: false, children: [] };
}

function container(
  title: string,
  status: string,
  fields: Record<string, unknown>,
  children: ProposedItem[],
): ProposedItem {
  return { title, status, fields, is_container: true, children };
}

// ---------- per-area seed builders ----------

function buildWork(context: OnboardingContext): ProposedPillar {
  const titlesByContext: Record<OnboardingContext, [string, string, string]> = {
    developer: [
      'revisar PRs pendientes',
      'actualizar tickets de la sprint',
      'cerrar issue bloqueado',
    ],
    freelancer: [
      'revisar pendientes del cliente',
      'llamada de seguimiento semanal',
      'entrega de avance',
    ],
    student: ['tarea principal de la semana', 'revisar pendientes', 'armar to-do de mañana'],
    builder:  ['tarea principal de la semana', 'revisar pendientes', 'armar to-do de mañana'],
    mix:      ['revisar PRs pendientes', 'actualizar tickets de la sprint', 'cerrar issue bloqueado'],
  };

  const [t1, t2, t3] = titlesByContext[context];
  const f = { type: 'task', priority: 'med' };

  return {
    templateKey: 'work',
    items: [
      leaf(t1, 'backlog', f),
      leaf(t2, 'backlog', f),
      leaf(t3, 'backlog', f),
    ],
  };
}

function buildUni(subjectCount: 'low' | 'mid' | 'high'): ProposedPillar {
  // low→2 subjects / mid→3 / high→4
  const counts: Record<'low' | 'mid' | 'high', { subjects: number; childrenPer: number }> = {
    low:  { subjects: 2, childrenPer: 1 },
    mid:  { subjects: 3, childrenPer: 2 },
    high: { subjects: 4, childrenPer: 1 },
  };

  const childTitles = ['TP en curso', 'parcial próximo', 'entrega pendiente', 'lectura obligatoria'];
  const { subjects, childrenPer } = counts[subjectCount];
  const semester = currentSemester();

  const items: ProposedItem[] = Array.from({ length: subjects }, (_, i) => {
    const children: ProposedItem[] = Array.from({ length: childrenPer }, (__, j) =>
      leaf(childTitles[(i * childrenPer + j) % childTitles.length], 'todo', {}),
    );
    return container(
      `Materia ${i + 1}`,
      'active',
      { semester, schedule: [] },
      children,
    );
  });

  return { templateKey: 'uni', items };
}

function buildFreelance(clientCount: 'one' | 'few' | 'many'): ProposedPillar {
  const counts: Record<'one' | 'few' | 'many', { clients: number; childrenPer: number }> = {
    one:  { clients: 1, childrenPer: 2 },
    few:  { clients: 2, childrenPer: 2 },
    many: { clients: 3, childrenPer: 2 },
  };

  const clientLabels = ['A', 'B', 'C'];
  const childTitles = ['kickoff inicial', 'revisión de avance', 'entrega final', 'bug crítico'];
  const { clients, childrenPer } = counts[clientCount];

  const items: ProposedItem[] = Array.from({ length: clients }, (_, i) => {
    const children: ProposedItem[] = Array.from({ length: childrenPer }, (__, j) =>
      leaf(childTitles[(i * childrenPer + j) % childTitles.length], 'backlog', { priority: 'med' }),
    );
    return container(
      `Cliente ${clientLabels[i]}`,
      'active',
      { stack: '', next_step: 'definir alcance inicial' },
      children,
    );
  });

  return { templateKey: 'freelance', items };
}

function buildProjects(context: OnboardingContext): ProposedPillar {
  const titlesByContext: Record<OnboardingContext, [string, string, string]> = {
    developer: ['proyecto en curso', 'idea a explorar', 'side project en pausa'],
    builder:   ['proyecto en curso', 'idea a explorar', 'side project en pausa'],
    student:   ['proyecto de la facu', 'idea para cuando tenga tiempo', 'repositorio a retomar'],
    freelancer:['producto propio', 'idea de SaaS', 'prototipo pendiente'],
    mix:       ['proyecto en curso', 'idea a explorar', 'side project en pausa'],
  };

  const [t1, t2, t3] = titlesByContext[context];
  const f = { next_step: 'definir próximo paso', last_update: '' };

  return {
    templateKey: 'projects',
    items: [
      leaf(t1, 'active', f),
      leaf(t2, 'active', f),
      leaf(t3, 'active', f),
    ],
  };
}

function buildCommunity(): ProposedPillar {
  return {
    templateKey: 'community',
    items: [
      container(
        'Mi comunidad principal',
        'active',
        { slug: 'my-community' },
        [
          leaf('compromiso próximo', 'pending', {}),
          leaf('meetup o evento pendiente', 'pending', {}),
        ],
      ),
    ],
  };
}

function buildBuild(): ProposedPillar {
  return {
    templateKey: 'build',
    items: [
      leaf('idea para esta semana',            'idea',      { platforms: ['x'], type: 'opinion' }),
      leaf('borrador en progreso',             'draft',     { platforms: ['x'], type: 'project' }),
      leaf('post a refinar antes de publicar', 'draft',     { platforms: ['x'], type: 'project' }),
      leaf('algo que ya compartí',             'published', { platforms: ['x'], type: 'project' }),
    ],
  };
}

// ---------- leaf-item counter (containers never count) ----------

function countLeafItems(pillars: ProposedPillar[]): number {
  let total = 0;
  for (const pillar of pillars) {
    for (const item of pillar.items) {
      if (!item.is_container) {
        total++;
      } else {
        total += item.children.length;
      }
    }
  }
  return total;
}

// Trim leaf items from the end of each pillar until we're under the limit.
// Containers that end up childless are also dropped (avoid orphaned shells).
function trimToLimit(pillars: ProposedPillar[], limit: number): ProposedPillar[] {
  let remaining = limit;
  return pillars.map((pillar) => {
    const items: ProposedItem[] = [];
    for (const item of pillar.items) {
      if (remaining <= 0) break;
      if (!item.is_container) {
        items.push(item);
        remaining--;
      } else {
        const children = item.children.slice(0, remaining);
        remaining -= children.length;
        if (children.length > 0) {
          items.push({ ...item, children });
        }
      }
    }
    return { ...pillar, items };
  });
}

// ---------- public API ----------

export function inferStructure(answers: OnboardingAnswers): ProposedStructure {
  const { context, areas, detail } = answers;

  const pillars: ProposedPillar[] = areas.map((area) => {
    switch (area) {
      case 'work':
        return buildWork(context);
      case 'uni':
        return buildUni(detail.subjectCount ?? 'mid');
      case 'freelance':
        return buildFreelance(detail.clientCount ?? 'few');
      case 'projects':
        return buildProjects(context);
      case 'community':
        return buildCommunity();
      case 'build':
        return buildBuild();
    }
  });

  const total = countLeafItems(pillars);
  if (total > FREE_LEAF_ITEM_LIMIT) {
    return { pillars: trimToLimit(pillars, FREE_LEAF_ITEM_LIMIT) };
  }

  return { pillars };
}
