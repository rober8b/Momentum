'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { checkLimit } from '@/lib/limits';
import { logAudit } from '@/lib/audit';
import {
  isProjectsDynamicEngineEnabled,
  isFreelanceDynamicEngineEnabled,
  isCommunityDynamicEngineEnabled,
  isUniDynamicEngineEnabled,
  isBuildDynamicEngineEnabled,
  isWorkDynamicEngineEnabled,
} from '@/lib/pillar-flags';
import { PROJECTS_TEMPLATE, FREELANCE_TEMPLATE, COMMUNITY_TEMPLATE, UNI_TEMPLATE, BUILD_TEMPLATE, WORK_TEMPLATE } from '@/lib/pillar-templates';
import { ensurePillarForUser, insertPillarItem } from '@/lib/pillar-writes';

// Leaf items (is_container=false) inserted by sample data — checked against the free plan limit.
const SAMPLE_LEAF_COUNT = 4 + 8 + 4 + 4 + 3 + 3; // assignments + workblocks + build + freelance tasks + projects + community

const PILLAR_PATHS = ['/', '/uni', '/work', '/freelance', '/projects', '/community', '/build'];

function revalidateAll() {
  for (const path of PILLAR_PATHS) revalidatePath(path);
}

/**
 * Inserts a representative set of sample rows scoped to the current user, all
 * flagged `is_sample: true`. Insert-only — never deletes or modifies existing
 * data. No-ops if the user already has sample data loaded.
 */
export async function loadSampleData(): Promise<{ alreadyLoaded?: boolean; skipped?: string[] }> {
  const user = await requireUser();

  // Phase 5b: when Uni is on the dynamic engine, sample subjects land in
  // pillar_items, not the legacy subjects table — check there instead, or
  // a re-click of "load sample data" would insert a second copy.
  const existing = isUniDynamicEngineEnabled()
    ? await db
        .select({ id: schema.pillarItems.id })
        .from(schema.pillarItems)
        .innerJoin(schema.pillars, eq(schema.pillars.id, schema.pillarItems.pillar_id))
        .where(and(eq(schema.pillars.user_id, user.id), eq(schema.pillars.key, UNI_TEMPLATE.key), eq(schema.pillarItems.is_sample, true)))
        .limit(1)
    : await db
        .select({ id: schema.subjects.id })
        .from(schema.subjects)
        .where(and(eq(schema.subjects.user_id, user.id), eq(schema.subjects.is_sample, true)))
        .limit(1);
  if (existing.length > 0) return { alreadyLoaded: true };

  // Single total-leaf check: containers (subjects, clients, orgs) are always
  // inserted; leaf items are skipped as a block if the cap wouldn't fit them.
  const leafCheck = await checkLimit(user.id, 'leaf_items');
  const includeLeafItems = leafCheck.limit === null || leafCheck.current + SAMPLE_LEAF_COUNT <= leafCheck.limit;

  const includeAssignments = includeLeafItems;
  const includeWorkblocks = includeLeafItems;
  const includeBuildItems = includeLeafItems;
  const includeFreelanceClients = true; // containers — never blocked
  const includeFreelanceTasks = includeLeafItems;
  const includeOwnProjects = includeLeafItems;
  const includeOrganizations = true; // containers — never blocked
  const includeCommunityItems = includeLeafItems;

  const skipped: string[] = [];
  if (!includeLeafItems) skipped.push('leaf_items');

  // ── SUBJECTS (no plan limit — always inserted) ──────────────────────────
  // Phase 5b: when Uni is on the dynamic engine, sample subjects go to
  // pillar_items (as containers, with fields.schedule/semester/vault_slug)
  // instead of the legacy subjects table — otherwise they'd be invisible to
  // /uni's own UI.
  let s1: string, s2: string, s3: string;
  let uniPillarId: string | null = null;
  if (isUniDynamicEngineEnabled()) {
    uniPillarId = await ensurePillarForUser(user.id, UNI_TEMPLATE);
    const subjectStatus = UNI_TEMPLATE.status_workflow[0].key;
    [s1, s2, s3] = await Promise.all([
      insertPillarItem({
        userId: user.id, pillarId: uniPillarId, isContainer: true, title: 'Product Management', status: subjectStatus, isSample: true,
        fields: { semester: '2026-1', vault_slug: 'product-management', schedule: [
          { day: 'mon', start: '09:00', end: '11:00', room: 'Room 201' },
          { day: 'wed', start: '09:00', end: '11:00', room: 'Room 201' },
        ] },
      }),
      insertPillarItem({
        userId: user.id, pillarId: uniPillarId, isContainer: true, title: 'Data Analytics', status: subjectStatus, isSample: true,
        fields: { semester: '2026-1', vault_slug: 'data-analytics', schedule: [{ day: 'tue', start: '14:00', end: '17:00', room: 'Lab A' }] },
      }),
      insertPillarItem({
        userId: user.id, pillarId: uniPillarId, isContainer: true, title: 'Business Strategy', status: subjectStatus, isSample: true,
        fields: { semester: '2026-1', vault_slug: 'business-strategy', schedule: [
          { day: 'thu', start: '18:00', end: '21:00', room: 'Auditorium' },
          { day: 'fri', start: '10:00', end: '12:00', room: 'Room 105' },
        ] },
      }),
    ]);
  } else {
    const subjectRows = await db
      .insert(schema.subjects)
      .values([
        {
          user_id: user.id,
          name: 'Product Management',
          semester: '2026-1',
          schedule: [
            { day: 'mon', start: '09:00', end: '11:00', room: 'Room 201' },
            { day: 'wed', start: '09:00', end: '11:00', room: 'Room 201' },
          ],
          vault_slug: 'product-management',
          is_sample: true,
        },
        {
          user_id: user.id,
          name: 'Data Analytics',
          semester: '2026-1',
          schedule: [{ day: 'tue', start: '14:00', end: '17:00', room: 'Lab A' }],
          vault_slug: 'data-analytics',
          is_sample: true,
        },
        {
          user_id: user.id,
          name: 'Business Strategy',
          semester: '2026-1',
          schedule: [
            { day: 'thu', start: '18:00', end: '21:00', room: 'Auditorium' },
            { day: 'fri', start: '10:00', end: '12:00', room: 'Room 105' },
          ],
          vault_slug: 'business-strategy',
          is_sample: true,
        },
      ])
      .returning({ id: schema.subjects.id });

    [s1, s2, s3] = subjectRows.map((r) => r.id);
  }

  // ── ASSIGNMENTS ──────────────────────────────────────────────────────────
  if (includeAssignments) {
    const today = new Date().toISOString().slice(0, 10);
    const inWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    if (uniPillarId) {
      await Promise.all([
        insertPillarItem({ userId: user.id, pillarId: uniPillarId, parentItemId: s1, isContainer: false, title: 'Product Roadmap Case Study', description: 'Analyze a SaaS product roadmap and propose improvements', dueDate: inWeek, status: 'todo', isSample: true }),
        insertPillarItem({ userId: user.id, pillarId: uniPillarId, parentItemId: s2, isContainer: false, title: 'Exploratory Data Analysis', description: 'EDA on the provided retail dataset using Python', dueDate: inTwoWeeks, status: 'in-progress', isSample: true }),
        insertPillarItem({ userId: user.id, pillarId: uniPillarId, parentItemId: s3, isContainer: false, title: 'Competitive Analysis Report', description: 'Porter 5 forces analysis for assigned industry', dueDate: today, status: 'todo', isSample: true }),
        insertPillarItem({ userId: user.id, pillarId: uniPillarId, parentItemId: s1, isContainer: false, title: 'User Research Interview', description: 'Conduct 3 user interviews and synthesize findings', dueDate: inTwoWeeks, status: 'done', isSample: true }),
      ]);
    } else {
      await db.insert(schema.assignments).values([
        { user_id: user.id, subject_id: s1, title: 'Product Roadmap Case Study', description: 'Analyze a SaaS product roadmap and propose improvements', due_date: inWeek, status: 'todo', is_sample: true },
        { user_id: user.id, subject_id: s2, title: 'Exploratory Data Analysis', description: 'EDA on the provided retail dataset using Python', due_date: inTwoWeeks, status: 'in-progress', is_sample: true },
        { user_id: user.id, subject_id: s3, title: 'Competitive Analysis Report', description: 'Porter 5 forces analysis for assigned industry', due_date: today, status: 'todo', is_sample: true },
        { user_id: user.id, subject_id: s1, title: 'User Research Interview', description: 'Conduct 3 user interviews and synthesize findings', due_date: inTwoWeeks, status: 'done', is_sample: true },
      ]);
    }
  }

  // ── WORKBLOCKS ───────────────────────────────────────────────────────────
  // Phase 6c: when Work is on the dynamic engine, sample workblocks go to
  // pillar_items instead of the legacy table. position is preserved
  // per-column exactly as the legacy sample data sets it — it's real manual
  // kanban ordering for Work, not vestigial like Build/Projects' position.
  if (includeWorkblocks) {
    if (isWorkDynamicEngineEnabled()) {
      const workPillarId = await ensurePillarForUser(user.id, WORK_TEMPLATE);
      await Promise.all([
        insertPillarItem({ userId: user.id, pillarId: workPillarId, isContainer: false, title: 'Fix authentication edge case on mobile', description: 'Users report login failing on iOS 17 Safari', status: 'in-progress', position: 0, isSample: true, fields: { type: 'ticket', priority: 'high', client: 'Acme Corp' } }),
        insertPillarItem({ userId: user.id, pillarId: workPillarId, isContainer: false, title: 'Write API documentation', description: 'Document all public endpoints with examples', status: 'today', position: 1, isSample: true, fields: { type: 'task', priority: 'med', client: 'Acme Corp' } }),
        insertPillarItem({ userId: user.id, pillarId: workPillarId, isContainer: false, title: 'Code review: payments module', description: 'PR #142 — stripe integration refactor', status: 'today', position: 2, isSample: true, fields: { type: 'review', priority: 'high', client: 'Acme Corp' } }),
        insertPillarItem({ userId: user.id, pillarId: workPillarId, isContainer: false, title: 'Dashboard loading performance', description: 'P95 load time over 3s — investigate queries', status: 'backlog', position: 0, isSample: true, fields: { type: 'ticket', priority: 'high', client: '' } }),
        insertPillarItem({ userId: user.id, pillarId: workPillarId, isContainer: false, title: 'Set up error monitoring', description: 'Integrate Sentry for frontend and backend', status: 'backlog', position: 1, isSample: true, fields: { type: 'task', priority: 'med', client: '' } }),
        insertPillarItem({ userId: user.id, pillarId: workPillarId, isContainer: false, title: 'Sprint planning Q3', description: '2-week sprint planning session', status: 'backlog', position: 2, isSample: true, fields: { type: 'meeting', priority: 'med', client: 'Acme Corp' } }),
        insertPillarItem({ userId: user.id, pillarId: workPillarId, isContainer: false, title: 'Update onboarding flow copy', description: 'A/B test results are in — implement winning variant', status: 'blocked', position: 0, isSample: true, fields: { type: 'task', priority: 'med', client: 'Acme Corp' } }),
        insertPillarItem({ userId: user.id, pillarId: workPillarId, isContainer: false, title: 'Migrate DB to Postgres 16', status: 'done', position: 0, isSample: true, fields: { type: 'ticket', priority: 'high', client: '' } }),
      ]);
    } else {
      await db.insert(schema.workblocks).values([
        { user_id: user.id, type: 'ticket', title: 'Fix authentication edge case on mobile', description: 'Users report login failing on iOS 17 Safari', status: 'in-progress', priority: 'high', client: 'Acme Corp', position: 0, is_sample: true },
        { user_id: user.id, type: 'task', title: 'Write API documentation', description: 'Document all public endpoints with examples', status: 'today', priority: 'med', client: 'Acme Corp', position: 1, is_sample: true },
        { user_id: user.id, type: 'review', title: 'Code review: payments module', description: 'PR #142 — stripe integration refactor', status: 'today', priority: 'high', client: 'Acme Corp', position: 2, is_sample: true },
        { user_id: user.id, type: 'ticket', title: 'Dashboard loading performance', description: 'P95 load time over 3s — investigate queries', status: 'backlog', priority: 'high', client: '', position: 0, is_sample: true },
        { user_id: user.id, type: 'task', title: 'Set up error monitoring', description: 'Integrate Sentry for frontend and backend', status: 'backlog', priority: 'med', client: '', position: 1, is_sample: true },
        { user_id: user.id, type: 'meeting', title: 'Sprint planning Q3', description: '2-week sprint planning session', status: 'backlog', priority: 'med', client: 'Acme Corp', position: 2, is_sample: true },
        { user_id: user.id, type: 'task', title: 'Update onboarding flow copy', description: 'A/B test results are in — implement winning variant', status: 'blocked', priority: 'med', client: 'Acme Corp', position: 0, is_sample: true },
        { user_id: user.id, type: 'ticket', title: 'Migrate DB to Postgres 16', status: 'done', priority: 'high', client: '', position: 0, is_sample: true },
      ]);
    }
  }

  // ── FREELANCE CLIENTS + TASKS ────────────────────────────────────────────
  // Phase 5b: when Freelance is on the dynamic engine, sample clients/tasks
  // go to pillar_items instead of the legacy tables.
  if (includeFreelanceClients) {
    if (isFreelanceDynamicEngineEnabled()) {
      const freelancePillarId = await ensurePillarForUser(user.id, FREELANCE_TEMPLATE);
      const [fc1, fc2] = await Promise.all([
        insertPillarItem({ userId: user.id, pillarId: freelancePillarId, isContainer: true, title: 'Bakery Store', description: 'E-commerce for local artisan bakery', status: 'active', isSample: true, fields: { icon: '🥐', stack: 'Next.js 14, Prisma, Stripe', next_step: 'Deploy new checkout flow', last_update: 'Fixed cart bug on mobile' } }),
        insertPillarItem({ userId: user.id, pillarId: freelancePillarId, isContainer: true, title: 'Dental Clinic', description: 'Appointment booking system', status: 'active', isSample: true, fields: { icon: '🦷', stack: 'Next.js 14, Supabase', next_step: 'Add SMS reminders', last_update: 'Updated calendar UI' } }),
      ]);

      if (includeFreelanceTasks) {
        await Promise.all([
          insertPillarItem({ userId: user.id, pillarId: freelancePillarId, parentItemId: fc1, isContainer: false, title: 'Implement discount codes', status: 'in-progress', isSample: true, fields: { priority: 'high' } }),
          insertPillarItem({ userId: user.id, pillarId: freelancePillarId, parentItemId: fc1, isContainer: false, title: 'Optimize product image loading', status: 'backlog', isSample: true, fields: { priority: 'med' } }),
          insertPillarItem({ userId: user.id, pillarId: freelancePillarId, parentItemId: fc2, isContainer: false, title: 'Add patient history view', status: 'today', isSample: true, fields: { priority: 'high' } }),
          insertPillarItem({ userId: user.id, pillarId: freelancePillarId, parentItemId: fc2, isContainer: false, title: 'Fix email notification template', status: 'done', isSample: true, fields: { priority: 'med' } }),
        ]);
      }
    } else {
      const clientRows = await db
        .insert(schema.freelanceClients)
        .values([
          { user_id: user.id, name: 'Bakery Store', icon: '🥐', description: 'E-commerce for local artisan bakery', status: 'active', stack: 'Next.js 14, Prisma, Stripe', next_step: 'Deploy new checkout flow', last_update: 'Fixed cart bug on mobile', is_sample: true },
          { user_id: user.id, name: 'Dental Clinic', icon: '🦷', description: 'Appointment booking system', status: 'active', stack: 'Next.js 14, Supabase', next_step: 'Add SMS reminders', last_update: 'Updated calendar UI', is_sample: true },
        ])
        .returning({ id: schema.freelanceClients.id });

      const [fc1, fc2] = clientRows.map((r) => r.id);

      if (includeFreelanceTasks) {
        await db.insert(schema.freelanceTasks).values([
          { user_id: user.id, client_id: fc1, title: 'Implement discount codes', status: 'in-progress', priority: 'high', is_sample: true },
          { user_id: user.id, client_id: fc1, title: 'Optimize product image loading', status: 'backlog', priority: 'med', is_sample: true },
          { user_id: user.id, client_id: fc2, title: 'Add patient history view', status: 'today', priority: 'high', is_sample: true },
          { user_id: user.id, client_id: fc2, title: 'Fix email notification template', status: 'done', priority: 'med', is_sample: true },
        ]);
      }
    }
  }

  // ── OWN PROJECTS ──────────────────────────────────────────────────────────
  // Phase 5b: when Projects is on the dynamic engine, sample projects go to
  // pillar_items instead of the legacy table.
  if (includeOwnProjects) {
    if (isProjectsDynamicEngineEnabled()) {
      const projectsPillarId = await ensurePillarForUser(user.id, PROJECTS_TEMPLATE);
      await Promise.all([
        insertPillarItem({ userId: user.id, pillarId: projectsPillarId, isContainer: false, title: 'SaaS Dashboard', description: 'B2B analytics dashboard for SMBs', status: 'active', isSample: true, fields: { icon: '📊', next_step: 'Build onboarding wizard', last_update: 'Completed auth flow' } }),
        insertPillarItem({ userId: user.id, pillarId: projectsPillarId, isContainer: false, title: 'CLI Tool', description: 'Developer productivity tool', status: 'active', isSample: true, fields: { icon: '⚡', next_step: 'Add autocomplete', last_update: 'Published v0.2.0' } }),
        insertPillarItem({ userId: user.id, pillarId: projectsPillarId, isContainer: false, title: 'Mobile App', description: 'Fitness tracking app — on hold', status: 'paused', isSample: true, fields: { icon: '📱', next_step: 'Resume after semester', last_update: 'Paused MVP work' } }),
      ]);
    } else {
      await db.insert(schema.ownProjects).values([
        { user_id: user.id, name: 'SaaS Dashboard', icon: '📊', description: 'B2B analytics dashboard for SMBs', status: 'active', next_step: 'Build onboarding wizard', last_update: 'Completed auth flow', is_sample: true },
        { user_id: user.id, name: 'CLI Tool', icon: '⚡', description: 'Developer productivity tool', status: 'active', next_step: 'Add autocomplete', last_update: 'Published v0.2.0', is_sample: true },
        { user_id: user.id, name: 'Mobile App', icon: '📱', description: 'Fitness tracking app — on hold', status: 'paused', next_step: 'Resume after semester', last_update: 'Paused MVP work', is_sample: true },
      ]);
    }
  }

  // ── ORGANIZATIONS + COMMUNITY ITEMS ─────────────────────────────────────
  // Phase 5b: when Community is on the dynamic engine, sample orgs/items go
  // to pillar_items instead of the legacy tables.
  if (includeOrganizations) {
    if (isCommunityDynamicEngineEnabled()) {
      const communityPillarId = await ensurePillarForUser(user.id, COMMUNITY_TEMPLATE);
      const containerStatus = COMMUNITY_TEMPLATE.status_workflow[0].key;
      const [org1, org2] = await Promise.all([
        insertPillarItem({ userId: user.id, pillarId: communityPillarId, isContainer: true, title: 'Dev Community', status: containerStatus, isSample: true, fields: { slug: 'dev-community' } }),
        insertPillarItem({ userId: user.id, pillarId: communityPillarId, isContainer: true, title: 'Local Startup Hub', status: containerStatus, isSample: true, fields: { slug: 'startup-hub' } }),
      ]);

      if (includeCommunityItems) {
        const today = new Date().toISOString().slice(0, 10);
        const inWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const nextWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        await Promise.all([
          insertPillarItem({ userId: user.id, pillarId: communityPillarId, parentItemId: org1, isContainer: false, title: 'Present side project at meetup', description: 'Demo the SaaS dashboard at monthly dev meetup', status: 'pending', dueDate: nextWeek, isSample: true }),
          insertPillarItem({ userId: user.id, pillarId: communityPillarId, parentItemId: org2, isContainer: false, title: 'Mentor session with founder', status: 'pending', dueDate: inWeek, isSample: true }),
          insertPillarItem({ userId: user.id, pillarId: communityPillarId, parentItemId: org1, isContainer: false, title: 'Review open source PR', description: 'Review the authentication module PR in the community repo', status: 'done', dueDate: today, isSample: true }),
        ]);
      }
    } else {
      const orgRows = await db
        .insert(schema.organizations)
        .values([
          { user_id: user.id, name: 'Dev Community', slug: 'dev-community', is_sample: true },
          { user_id: user.id, name: 'Local Startup Hub', slug: 'startup-hub', is_sample: true },
        ])
        .returning({ id: schema.organizations.id });

      const [org1, org2] = orgRows.map((r) => r.id);

      if (includeCommunityItems) {
        const today = new Date().toISOString().slice(0, 10);
        const inWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const nextWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        await db.insert(schema.communityItems).values([
          { user_id: user.id, organization_id: org1, title: 'Present side project at meetup', description: 'Demo the SaaS dashboard at monthly dev meetup', status: 'pending', due_date: nextWeek, is_sample: true },
          { user_id: user.id, organization_id: org2, title: 'Mentor session with founder', status: 'pending', due_date: inWeek, is_sample: true },
          { user_id: user.id, organization_id: org1, title: 'Review open source PR', description: 'Review the authentication module PR in the community repo', status: 'done', due_date: today, is_sample: true },
        ]);
      }
    }
  }

  // ── BUILD ITEMS ───────────────────────────────────────────────────────────
  // Phase 6b: when Build is on the dynamic engine, sample build items go to
  // pillar_items instead of the legacy table.
  if (includeBuildItems) {
    if (isBuildDynamicEngineEnabled()) {
      const buildPillarId = await ensurePillarForUser(user.id, BUILD_TEMPLATE);
      await Promise.all([
        insertPillarItem({ userId: user.id, pillarId: buildPillarId, isContainer: false, title: 'Built a CLI tool in a weekend', status: 'draft', isSample: true, fields: { type: 'project', hook: 'I built a developer productivity CLI in 48 hours. Here is what I learned.', platforms: ['x', 'linkedin'] } }),
        insertPillarItem({ userId: user.id, pillarId: buildPillarId, isContainer: false, title: 'Why I stopped using ORMs', status: 'idea', isSample: true, fields: { type: 'opinion', platforms: ['x'] } }),
        insertPillarItem({ userId: user.id, pillarId: buildPillarId, isContainer: false, title: 'Open sourcing my SaaS boilerplate', status: 'published', isSample: true, fields: { type: 'open-source', hook: 'After 6 months of building in private, I am open sourcing everything.', platforms: ['x', 'linkedin'] } }),
        insertPillarItem({ userId: user.id, pillarId: buildPillarId, isContainer: false, title: 'Demo: auth in 5 minutes', status: 'idea', isSample: true, fields: { type: 'demo', hook: 'Full auth system — signup, login, password reset — in under 5 minutes.', platforms: ['x'] } }),
      ]);
    } else {
      await db.insert(schema.buildItems).values([
        { user_id: user.id, type: 'project', title: 'Built a CLI tool in a weekend', hook: 'I built a developer productivity CLI in 48 hours. Here is what I learned.', status: 'draft', platforms: ['x', 'linkedin'], is_sample: true },
        { user_id: user.id, type: 'opinion', title: 'Why I stopped using ORMs', status: 'idea', platforms: ['x'], is_sample: true },
        { user_id: user.id, type: 'open-source', title: 'Open sourcing my SaaS boilerplate', hook: 'After 6 months of building in private, I am open sourcing everything.', status: 'published', platforms: ['x', 'linkedin'], is_sample: true },
        { user_id: user.id, type: 'demo', title: 'Demo: auth in 5 minutes', hook: 'Full auth system — signup, login, password reset — in under 5 minutes.', status: 'idea', platforms: ['x'], is_sample: true },
      ]);
    }
  }

  logAudit({ userId: user.id, action: 'sample_data_loaded', metadata: { skipped } });
  revalidateAll();
  return { skipped: skipped.length > 0 ? skipped : undefined };
}

/**
 * Deletes only the rows previously created by `loadSampleData()` for the
 * current user. Every delete is scoped to BOTH `user_id = currentUser.id` AND
 * `is_sample = true` — it can never touch another user's rows or this user's
 * real data.
 */
export async function removeSampleData(): Promise<void> {
  const user = await requireUser();

  // Legacy tables — always cleaned regardless of current flag state. Sample
  // data may have been loaded before a pillar's cutover, or carried into
  // pillar_items by a migration script that mirrored is_sample rows, so
  // legacy rows can exist even with the flag currently on. See Phase 5b
  // notes in docs/DYNAMIC_PILLARS.md.
  await db.delete(schema.communityItems).where(and(eq(schema.communityItems.user_id, user.id), eq(schema.communityItems.is_sample, true)));
  await db.delete(schema.organizations).where(and(eq(schema.organizations.user_id, user.id), eq(schema.organizations.is_sample, true)));
  await db.delete(schema.freelanceTasks).where(and(eq(schema.freelanceTasks.user_id, user.id), eq(schema.freelanceTasks.is_sample, true)));
  await db.delete(schema.freelanceClients).where(and(eq(schema.freelanceClients.user_id, user.id), eq(schema.freelanceClients.is_sample, true)));
  await db.delete(schema.ownProjects).where(and(eq(schema.ownProjects.user_id, user.id), eq(schema.ownProjects.is_sample, true)));
  await db.delete(schema.buildItems).where(and(eq(schema.buildItems.user_id, user.id), eq(schema.buildItems.is_sample, true)));
  await db.delete(schema.workblocks).where(and(eq(schema.workblocks.user_id, user.id), eq(schema.workblocks.is_sample, true)));
  await db.delete(schema.assignments).where(and(eq(schema.assignments.user_id, user.id), eq(schema.assignments.is_sample, true)));
  await db.delete(schema.subjects).where(and(eq(schema.subjects.user_id, user.id), eq(schema.subjects.is_sample, true)));

  // pillar_items — same unconditional cleanup, scoped to user + is_sample.
  // Child rows first for FK safety (no cascade from container -> child here).
  await db.delete(schema.pillarItems).where(and(eq(schema.pillarItems.user_id, user.id), eq(schema.pillarItems.is_sample, true), eq(schema.pillarItems.is_container, false)));
  await db.delete(schema.pillarItems).where(and(eq(schema.pillarItems.user_id, user.id), eq(schema.pillarItems.is_sample, true), eq(schema.pillarItems.is_container, true)));

  logAudit({ userId: user.id, action: 'sample_data_removed' });
  revalidateAll();
}
