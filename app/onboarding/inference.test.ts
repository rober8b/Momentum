import { describe, it, expect } from 'vitest';
import { inferStructure } from './inference';
import { FREE_LEAF_ITEM_LIMIT } from '@/lib/plans';
import type { OnboardingAnswers } from './types';

// ---------- helpers ----------

function countLeaves(pillars: ReturnType<typeof inferStructure>['pillars']): number {
  return pillars.reduce(
    (sum, p) =>
      sum +
      p.items.reduce((s, item) => s + (item.is_container ? item.children.length : 1), 0),
    0,
  );
}

function allItems(pillars: ReturnType<typeof inferStructure>['pillars']) {
  return pillars.flatMap((p) => [
    ...p.items,
    ...p.items.flatMap((item) => item.children),
  ]);
}

function makeAnswers(overrides: Partial<OnboardingAnswers>): OnboardingAnswers {
  return {
    context: 'developer',
    areas: ['work'],
    detail: {},
    ...overrides,
  };
}

// ---------- area → template key ----------

describe('inferStructure — template keys and area order', () => {
  it('returns one pillar per area, in the same order', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['work', 'projects', 'build'] }),
    );
    expect(pillars.map((p) => p.templateKey)).toEqual(['work', 'projects', 'build']);
  });

  it('student defaults: uni, community, projects', () => {
    const { pillars } = inferStructure(
      makeAnswers({
        context: 'student',
        areas: ['uni', 'community', 'projects'],
        detail: { subjectCount: 'mid' },
      }),
    );
    expect(pillars.map((p) => p.templateKey)).toEqual(['uni', 'community', 'projects']);
  });

  it('freelancer areas produce correct template keys', () => {
    const { pillars } = inferStructure(
      makeAnswers({
        context: 'freelancer',
        areas: ['freelance', 'work', 'projects'],
        detail: { clientCount: 'few' },
      }),
    );
    expect(pillars.map((p) => p.templateKey)).toEqual(['freelance', 'work', 'projects']);
  });
});

// ---------- flat pillars (no containers) ----------

describe('inferStructure — flat pillars (work, projects, build)', () => {
  it('work: produces 3 leaf items, no containers', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['work'] }));
    const [work] = pillars;
    expect(work.items).toHaveLength(3);
    expect(work.items.every((i) => !i.is_container)).toBe(true);
    expect(work.items.every((i) => i.children.length === 0)).toBe(true);
  });

  it('work: leaf items have status backlog and type/priority fields', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['work'] }));
    for (const item of pillars[0].items) {
      expect(item.status).toBe('backlog');
      expect(item.fields).toMatchObject({ type: 'task', priority: 'med' });
    }
  });

  it('work: titles vary by context (developer vs freelancer)', () => {
    const dev = inferStructure(makeAnswers({ context: 'developer', areas: ['work'] }));
    const fl = inferStructure(makeAnswers({ context: 'freelancer', areas: ['work'] }));
    const devTitles = dev.pillars[0].items.map((i) => i.title);
    const flTitles = fl.pillars[0].items.map((i) => i.title);
    expect(devTitles).not.toEqual(flTitles);
  });

  it('projects: produces 3 leaf items with status active', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['projects'] }));
    const [p] = pillars;
    expect(p.items).toHaveLength(3);
    expect(p.items.every((i) => i.status === 'active')).toBe(true);
  });

  it('projects: titles differ for student vs developer', () => {
    const dev = inferStructure(makeAnswers({ context: 'developer', areas: ['projects'] }));
    const stu = inferStructure(makeAnswers({ context: 'student', areas: ['projects'] }));
    expect(dev.pillars[0].items.map((i) => i.title)).not.toEqual(
      stu.pillars[0].items.map((i) => i.title),
    );
  });

  it('build: 4 items with correct statuses (idea → draft → draft → published)', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['build'] }));
    const statuses = pillars[0].items.map((i) => i.status);
    expect(statuses).toEqual(['idea', 'draft', 'draft', 'published']);
  });

  it('build: all items have platforms field', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['build'] }));
    for (const item of pillars[0].items) {
      expect(item.fields).toHaveProperty('platforms');
    }
  });
});

// ---------- hierarchical: uni ----------

describe('inferStructure — uni (hierarchical)', () => {
  it('subjectCount low → 2 containers, 1 child each', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['uni'], detail: { subjectCount: 'low' } }),
    );
    const [uni] = pillars;
    expect(uni.items).toHaveLength(2);
    expect(uni.items.every((i) => i.is_container)).toBe(true);
    expect(uni.items.every((i) => i.children.length === 1)).toBe(true);
  });

  it('subjectCount mid → 3 containers, 2 children each (6 leaf items total)', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['uni'], detail: { subjectCount: 'mid' } }),
    );
    const [uni] = pillars;
    expect(uni.items).toHaveLength(3);
    expect(uni.items.every((i) => i.children.length === 2)).toBe(true);
    expect(countLeaves(pillars)).toBe(6);
  });

  it('subjectCount high → 4 containers, 1 child each', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['uni'], detail: { subjectCount: 'high' } }),
    );
    const [uni] = pillars;
    expect(uni.items).toHaveLength(4);
    expect(uni.items.every((i) => i.children.length === 1)).toBe(true);
  });

  it('uni containers have semester in fields', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['uni'], detail: { subjectCount: 'mid' } }),
    );
    for (const item of pillars[0].items) {
      expect(item.fields).toHaveProperty('semester');
      expect(typeof item.fields.semester).toBe('string');
    }
  });

  it('uni children have is_container: false and no children', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['uni'], detail: { subjectCount: 'mid' } }),
    );
    for (const container of pillars[0].items) {
      for (const child of container.children) {
        expect(child.is_container).toBe(false);
        expect(child.children).toHaveLength(0);
      }
    }
  });

  it('defaults to mid when subjectCount is missing', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['uni'], detail: {} }));
    expect(pillars[0].items).toHaveLength(3); // mid default
  });
});

// ---------- hierarchical: freelance ----------

describe('inferStructure — freelance (hierarchical)', () => {
  it('clientCount one → 1 container, 2 children', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['freelance'], detail: { clientCount: 'one' } }),
    );
    const [fl] = pillars;
    expect(fl.items).toHaveLength(1);
    expect(fl.items[0].children).toHaveLength(2);
  });

  it('clientCount few → 2 containers × 2 children (4 leaf items)', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['freelance'], detail: { clientCount: 'few' } }),
    );
    expect(pillars[0].items).toHaveLength(2);
    expect(countLeaves(pillars)).toBe(4);
  });

  it('clientCount many → 3 containers × 2 children', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['freelance'], detail: { clientCount: 'many' } }),
    );
    expect(pillars[0].items).toHaveLength(3);
    expect(countLeaves(pillars)).toBe(6);
  });

  it('freelance containers have stack and next_step fields', () => {
    const { pillars } = inferStructure(
      makeAnswers({ areas: ['freelance'], detail: { clientCount: 'few' } }),
    );
    for (const c of pillars[0].items) {
      expect(c.fields).toHaveProperty('stack');
      expect(c.fields).toHaveProperty('next_step');
    }
  });

  it('defaults to few when clientCount is missing', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['freelance'], detail: {} }));
    expect(pillars[0].items).toHaveLength(2); // few default
  });
});

// ---------- hierarchical: community ----------

describe('inferStructure — community', () => {
  it('produces 1 container with 2 children', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['community'] }));
    const [comm] = pillars;
    expect(comm.items).toHaveLength(1);
    expect(comm.items[0].is_container).toBe(true);
    expect(comm.items[0].children).toHaveLength(2);
  });

  it('children have status pending', () => {
    const { pillars } = inferStructure(makeAnswers({ areas: ['community'] }));
    for (const child of pillars[0].items[0].children) {
      expect(child.status).toBe('pending');
    }
  });
});

// ---------- is_container invariants ----------

describe('inferStructure — is_container is always explicit', () => {
  it('every item with children has is_container: true', () => {
    const { pillars } = inferStructure(
      makeAnswers({
        context: 'mix',
        areas: ['work', 'uni', 'freelance', 'projects', 'community', 'build'],
        detail: { subjectCount: 'mid', clientCount: 'few' },
      }),
    );
    for (const p of pillars) {
      for (const item of p.items) {
        if (item.children.length > 0) {
          expect(item.is_container).toBe(true);
        }
      }
    }
  });

  it('every leaf item has is_container: false and children: []', () => {
    const { pillars } = inferStructure(
      makeAnswers({
        context: 'mix',
        areas: ['work', 'uni', 'freelance', 'projects', 'community', 'build'],
        detail: { subjectCount: 'mid', clientCount: 'few' },
      }),
    );
    const leaves = allItems(pillars).filter((i) => !i.is_container);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(leaf.children).toHaveLength(0);
    }
  });
});

// ---------- free-plan limit ----------

describe('inferStructure — stays under FREE_LEAF_ITEM_LIMIT', () => {
  it('mix with all 6 areas and maximum detail never exceeds the limit', () => {
    const { pillars } = inferStructure({
      context: 'mix',
      areas: ['work', 'uni', 'freelance', 'projects', 'community', 'build'],
      detail: { subjectCount: 'high', clientCount: 'many' },
    });
    expect(countLeaves(pillars)).toBeLessThanOrEqual(FREE_LEAF_ITEM_LIMIT);
  });

  it('single-area proposals are well within the limit', () => {
    for (const area of ['work', 'projects', 'build', 'community'] as const) {
      const { pillars } = inferStructure(makeAnswers({ areas: [area] }));
      expect(countLeaves(pillars)).toBeLessThan(10);
    }
  });
});
