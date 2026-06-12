'use server';

import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { checkLimit } from '@/lib/limits';
import { logAudit } from '@/lib/audit';

const SAMPLE_COUNTS = {
  assignments: 4,
  workblocks: 8,
  build_items: 4,
  freelance_clients: 2,
  freelance_tasks: 4,
  own_projects: 3,
  organizations: 2,
  community_items: 3,
} as const;

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

  const [existing] = await db
    .select({ id: schema.subjects.id })
    .from(schema.subjects)
    .where(and(eq(schema.subjects.user_id, user.id), eq(schema.subjects.is_sample, true)))
    .limit(1);
  if (existing) return { alreadyLoaded: true };

  const [
    assignmentsCheck,
    workblocksCheck,
    buildItemsCheck,
    freelanceClientsCheck,
    freelanceTasksCheck,
    ownProjectsCheck,
    organizationsCheck,
    communityItemsCheck,
  ] = await Promise.all([
    checkLimit(user.id, 'assignments'),
    checkLimit(user.id, 'workblocks'),
    checkLimit(user.id, 'build_items'),
    checkLimit(user.id, 'freelance_clients'),
    checkLimit(user.id, 'freelance_tasks'),
    checkLimit(user.id, 'own_projects'),
    checkLimit(user.id, 'organizations'),
    checkLimit(user.id, 'community_items'),
  ]);

  const fits = (check: { current: number; limit: number | null }, count: number) =>
    check.limit === null || check.current + count <= check.limit;

  const includeAssignments = fits(assignmentsCheck, SAMPLE_COUNTS.assignments);
  const includeWorkblocks = fits(workblocksCheck, SAMPLE_COUNTS.workblocks);
  const includeBuildItems = fits(buildItemsCheck, SAMPLE_COUNTS.build_items);
  const includeFreelanceClients = fits(freelanceClientsCheck, SAMPLE_COUNTS.freelance_clients);
  const includeFreelanceTasks = includeFreelanceClients && fits(freelanceTasksCheck, SAMPLE_COUNTS.freelance_tasks);
  const includeOwnProjects = fits(ownProjectsCheck, SAMPLE_COUNTS.own_projects);
  const includeOrganizations = fits(organizationsCheck, SAMPLE_COUNTS.organizations);
  const includeCommunityItems = includeOrganizations && fits(communityItemsCheck, SAMPLE_COUNTS.community_items);

  const skipped: string[] = [];
  if (!includeAssignments) skipped.push('assignments');
  if (!includeWorkblocks) skipped.push('workblocks');
  if (!includeBuildItems) skipped.push('build_items');
  if (!includeFreelanceClients) skipped.push('freelance_clients');
  else if (!includeFreelanceTasks) skipped.push('freelance_tasks');
  if (!includeOwnProjects) skipped.push('own_projects');
  if (!includeOrganizations) skipped.push('organizations');
  else if (!includeCommunityItems) skipped.push('community_items');

  // ── SUBJECTS (no plan limit — always inserted) ──────────────────────────
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

  const [s1, s2, s3] = subjectRows.map((r) => r.id);

  // ── ASSIGNMENTS ──────────────────────────────────────────────────────────
  if (includeAssignments) {
    const today = new Date().toISOString().slice(0, 10);
    const inWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await db.insert(schema.assignments).values([
      { user_id: user.id, subject_id: s1, title: 'Product Roadmap Case Study', description: 'Analyze a SaaS product roadmap and propose improvements', due_date: inWeek, status: 'todo', is_sample: true },
      { user_id: user.id, subject_id: s2, title: 'Exploratory Data Analysis', description: 'EDA on the provided retail dataset using Python', due_date: inTwoWeeks, status: 'in-progress', is_sample: true },
      { user_id: user.id, subject_id: s3, title: 'Competitive Analysis Report', description: 'Porter 5 forces analysis for assigned industry', due_date: today, status: 'todo', is_sample: true },
      { user_id: user.id, subject_id: s1, title: 'User Research Interview', description: 'Conduct 3 user interviews and synthesize findings', due_date: inTwoWeeks, status: 'done', is_sample: true },
    ]);
  }

  // ── WORKBLOCKS ───────────────────────────────────────────────────────────
  if (includeWorkblocks) {
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

  // ── FREELANCE CLIENTS + TASKS ────────────────────────────────────────────
  if (includeFreelanceClients) {
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

  // ── OWN PROJECTS ──────────────────────────────────────────────────────────
  if (includeOwnProjects) {
    await db.insert(schema.ownProjects).values([
      { user_id: user.id, name: 'SaaS Dashboard', icon: '📊', description: 'B2B analytics dashboard for SMBs', status: 'active', next_step: 'Build onboarding wizard', last_update: 'Completed auth flow', is_sample: true },
      { user_id: user.id, name: 'CLI Tool', icon: '⚡', description: 'Developer productivity tool', status: 'active', next_step: 'Add autocomplete', last_update: 'Published v0.2.0', is_sample: true },
      { user_id: user.id, name: 'Mobile App', icon: '📱', description: 'Fitness tracking app — on hold', status: 'paused', next_step: 'Resume after semester', last_update: 'Paused MVP work', is_sample: true },
    ]);
  }

  // ── ORGANIZATIONS + COMMUNITY ITEMS ─────────────────────────────────────
  if (includeOrganizations) {
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

  // ── BUILD ITEMS ───────────────────────────────────────────────────────────
  if (includeBuildItems) {
    await db.insert(schema.buildItems).values([
      { user_id: user.id, type: 'project', title: 'Built a CLI tool in a weekend', hook: 'I built a developer productivity CLI in 48 hours. Here is what I learned.', status: 'draft', platforms: ['x', 'linkedin'], is_sample: true },
      { user_id: user.id, type: 'opinion', title: 'Why I stopped using ORMs', status: 'idea', platforms: ['x'], is_sample: true },
      { user_id: user.id, type: 'open-source', title: 'Open sourcing my SaaS boilerplate', hook: 'After 6 months of building in private, I am open sourcing everything.', status: 'published', platforms: ['x', 'linkedin'], is_sample: true },
      { user_id: user.id, type: 'demo', title: 'Demo: auth in 5 minutes', hook: 'Full auth system — signup, login, password reset — in under 5 minutes.', status: 'idea', platforms: ['x'], is_sample: true },
    ]);
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

  await db.delete(schema.communityItems).where(and(eq(schema.communityItems.user_id, user.id), eq(schema.communityItems.is_sample, true)));
  await db.delete(schema.organizations).where(and(eq(schema.organizations.user_id, user.id), eq(schema.organizations.is_sample, true)));
  await db.delete(schema.freelanceTasks).where(and(eq(schema.freelanceTasks.user_id, user.id), eq(schema.freelanceTasks.is_sample, true)));
  await db.delete(schema.freelanceClients).where(and(eq(schema.freelanceClients.user_id, user.id), eq(schema.freelanceClients.is_sample, true)));
  await db.delete(schema.ownProjects).where(and(eq(schema.ownProjects.user_id, user.id), eq(schema.ownProjects.is_sample, true)));
  await db.delete(schema.buildItems).where(and(eq(schema.buildItems.user_id, user.id), eq(schema.buildItems.is_sample, true)));
  await db.delete(schema.workblocks).where(and(eq(schema.workblocks.user_id, user.id), eq(schema.workblocks.is_sample, true)));
  await db.delete(schema.assignments).where(and(eq(schema.assignments.user_id, user.id), eq(schema.assignments.is_sample, true)));
  await db.delete(schema.subjects).where(and(eq(schema.subjects.user_id, user.id), eq(schema.subjects.is_sample, true)));

  logAudit({ userId: user.id, action: 'sample_data_removed' });
  revalidateAll();
}
