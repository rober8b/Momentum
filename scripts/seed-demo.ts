/**
 * seed:demo — creates 1 demo user + representative fictional data across all pilars.
 *
 * Run: node --env-file=.env.local --input-type=module < scripts/seed-demo.ts
 *
 * WARNING: drops all existing data before seeding.
 * Only use in dev/staging environments.
 */

import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is required');

const sql = postgres(DATABASE_URL, { max: 1 });

// Simple bcrypt-like password hash for demo (uses sha256 — NOT for prod auth)
// Real auth uses bcryptjs; this seed script uses a simpler approach to avoid
// importing the app's auth module from a raw Node script.
async function hashPassword(password: string): Promise<string> {
  // bcrypt format that bcryptjs will recognize: use a real hash
  // We'll insert a known bcrypt hash for 'demo1234'
  // Generated with: bcryptjs.hashSync('demo1234', 10)
  // This is intentionally a static hash for the demo password only.
  const _ = password; // suppress unused warning
  return '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'; // 'demo1234'
}

async function clearAll() {
  console.log('Clearing existing data…');
  // Clear in dependency order
  await sql`DELETE FROM vault_exports`;
  await sql`DELETE FROM community_items`;
  await sql`DELETE FROM organizations`;
  await sql`DELETE FROM build_items`;
  await sql`DELETE FROM freelance_tasks`;
  await sql`DELETE FROM freelance_clients`;
  await sql`DELETE FROM own_projects`;
  await sql`DELETE FROM assignments`;
  await sql`DELETE FROM subjects`;
  await sql`DELETE FROM password_reset_tokens`;
  await sql`DELETE FROM login_attempts`;
  await sql`DELETE FROM audit_log`;
  await sql`DELETE FROM users`;
  console.log('Cleared.');
}

async function run() {
  console.log('seed:demo starting…');
  await clearAll();

  // ── DEMO USER ────────────────────────────────────────────────────────────
  const userId = randomUUID();
  const passwordHash = await hashPassword('demo1234');

  await sql`
    INSERT INTO users (id, email, display_name, password_hash, role, active, settings)
    VALUES (
      ${userId},
      'demo@example.com',
      'Demo User',
      ${passwordHash},
      'admin',
      true,
      ${JSON.stringify({
        timezone: 'America/New_York',
        language: 'en',
        theme: 'dark',
        export_enabled: true,
        vault_path: '',
      })}
    )
  `;
  console.log(`Created demo user: demo@example.com / demo1234`);

  // ── SUBJECTS ─────────────────────────────────────────────────────────────
  const s1 = randomUUID();
  const s2 = randomUUID();
  const s3 = randomUUID();

  await sql`
    INSERT INTO subjects (id, user_id, name, semester, schedule, active, vault_slug) VALUES
    (${s1}, ${userId}, 'Product Management', '2026-1', ${JSON.stringify([
      { day: 'mon', start: '09:00', end: '11:00', room: 'Room 201' },
      { day: 'wed', start: '09:00', end: '11:00', room: 'Room 201' },
    ])}, true, 'product-management'),
    (${s2}, ${userId}, 'Data Analytics', '2026-1', ${JSON.stringify([
      { day: 'tue', start: '14:00', end: '17:00', room: 'Lab A' },
    ])}, true, 'data-analytics'),
    (${s3}, ${userId}, 'Business Strategy', '2026-1', ${JSON.stringify([
      { day: 'thu', start: '18:00', end: '21:00', room: 'Auditorium' },
      { day: 'fri', start: '10:00', end: '12:00', room: 'Room 105' },
    ])}, true, 'business-strategy')
  `;
  console.log('Created 3 subjects.');

  // ── ASSIGNMENTS ──────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const inWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const inTwoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await sql`
    INSERT INTO assignments (id, user_id, subject_id, title, description, due_date, status) VALUES
    (${randomUUID()}, ${userId}, ${s1}, 'Product Roadmap Case Study', 'Analyze a SaaS product roadmap and propose improvements', ${inWeek}, 'todo'),
    (${randomUUID()}, ${userId}, ${s2}, 'Exploratory Data Analysis', 'EDA on the provided retail dataset using Python', ${inTwoWeeks}, 'in-progress'),
    (${randomUUID()}, ${userId}, ${s3}, 'Competitive Analysis Report', 'Porter 5 forces analysis for assigned industry', ${today}, 'todo'),
    (${randomUUID()}, ${userId}, ${s1}, 'User Research Interview', 'Conduct 3 user interviews and synthesize findings', ${inTwoWeeks}, 'done')
  `;
  console.log('Created 4 assignments.');

  // ── WORKBLOCKS ───────────────────────────────────────────────────────────
  await sql`
    INSERT INTO workblocks (id, user_id, type, title, description, status, priority, client, position) VALUES
    (${randomUUID()}, ${userId}, 'ticket', 'Fix authentication edge case on mobile', 'Users report login failing on iOS 17 Safari', 'in-progress', 'high', 'Acme Corp', 0),
    (${randomUUID()}, ${userId}, 'task', 'Write API documentation', 'Document all public endpoints with examples', 'today', 'med', 'Acme Corp', 1),
    (${randomUUID()}, ${userId}, 'review', 'Code review: payments module', 'PR #142 — stripe integration refactor', 'today', 'high', 'Acme Corp', 2),
    (${randomUUID()}, ${userId}, 'ticket', 'Dashboard loading performance', 'P95 load time over 3s — investigate queries', 'backlog', 'high', '', 0),
    (${randomUUID()}, ${userId}, 'task', 'Set up error monitoring', 'Integrate Sentry for frontend and backend', 'backlog', 'med', '', 1),
    (${randomUUID()}, ${userId}, 'meeting', 'Sprint planning Q3', '2-week sprint planning session', 'backlog', 'med', 'Acme Corp', 2),
    (${randomUUID()}, ${userId}, 'task', 'Update onboarding flow copy', 'A/B test results are in — implement winning variant', 'blocked', 'med', 'Acme Corp', 0),
    (${randomUUID()}, ${userId}, 'ticket', 'Migrate DB to Postgres 16', null, 'done', 'high', '', 0)
  `;
  console.log('Created 8 workblocks.');

  // ── FREELANCE CLIENTS ─────────────────────────────────────────────────────
  const fc1 = randomUUID();
  const fc2 = randomUUID();

  await sql`
    INSERT INTO freelance_clients (id, user_id, name, icon, description, status, stack, next_step, last_update) VALUES
    (${fc1}, ${userId}, 'Bakery Store', '🥐', 'E-commerce for local artisan bakery', 'active', 'Next.js 14, Prisma, Stripe', 'Deploy new checkout flow', 'Fixed cart bug on mobile'),
    (${fc2}, ${userId}, 'Dental Clinic', '🦷', 'Appointment booking system', 'active', 'Next.js 14, Supabase', 'Add SMS reminders', 'Updated calendar UI')
  `;
  console.log('Created 2 freelance clients.');

  // ── FREELANCE TASKS ───────────────────────────────────────────────────────
  await sql`
    INSERT INTO freelance_tasks (id, user_id, client_id, title, status, priority) VALUES
    (${randomUUID()}, ${userId}, ${fc1}, 'Implement discount codes', 'in-progress', 'high'),
    (${randomUUID()}, ${userId}, ${fc1}, 'Optimize product image loading', 'backlog', 'med'),
    (${randomUUID()}, ${userId}, ${fc2}, 'Add patient history view', 'today', 'high'),
    (${randomUUID()}, ${userId}, ${fc2}, 'Fix email notification template', 'done', 'med')
  `;
  console.log('Created 4 freelance tasks.');

  // ── OWN PROJECTS ──────────────────────────────────────────────────────────
  await sql`
    INSERT INTO own_projects (id, user_id, name, icon, description, status, next_step, last_update) VALUES
    (${randomUUID()}, ${userId}, 'SaaS Dashboard', '📊', 'B2B analytics dashboard for SMBs', 'active', 'Build onboarding wizard', 'Completed auth flow'),
    (${randomUUID()}, ${userId}, 'CLI Tool', '⚡', 'Developer productivity tool', 'active', 'Add autocomplete', 'Published v0.2.0'),
    (${randomUUID()}, ${userId}, 'Mobile App', '📱', 'Fitness tracking app — on hold', 'paused', 'Resume after semester', 'Paused MVP work')
  `;
  console.log('Created 3 own projects.');

  // ── ORGANIZATIONS ─────────────────────────────────────────────────────────
  const org1 = randomUUID();
  const org2 = randomUUID();

  await sql`
    INSERT INTO organizations (id, user_id, name, slug) VALUES
    (${org1}, ${userId}, 'Dev Community', 'dev-community'),
    (${org2}, ${userId}, 'Local Startup Hub', 'startup-hub')
  `;
  console.log('Created 2 organizations.');

  // ── COMMUNITY ITEMS ───────────────────────────────────────────────────────
  const nextWeek = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await sql`
    INSERT INTO community_items (id, user_id, organization_id, title, description, status, due_date) VALUES
    (${randomUUID()}, ${userId}, ${org1}, 'Present side project at meetup', 'Demo the SaaS dashboard at monthly dev meetup', 'pending', ${nextWeek}),
    (${randomUUID()}, ${userId}, ${org2}, 'Mentor session with founder', null, 'pending', ${inWeek}),
    (${randomUUID()}, ${userId}, ${org1}, 'Review open source PR', 'Review the authentication module PR in the community repo', 'done', ${today})
  `;
  console.log('Created 3 community items.');

  // ── BUILD ITEMS ───────────────────────────────────────────────────────────
  await sql`
    INSERT INTO build_items (id, user_id, type, title, hook, status, platforms) VALUES
    (${randomUUID()}, ${userId}, 'project', 'Built a CLI tool in a weekend', 'I built a developer productivity CLI in 48 hours. Here is what I learned.', 'draft', ARRAY['x', 'linkedin']),
    (${randomUUID()}, ${userId}, 'opinion', 'Why I stopped using ORMs', null, 'idea', ARRAY['x']),
    (${randomUUID()}, ${userId}, 'open-source', 'Open sourcing my SaaS boilerplate', 'After 6 months of building in private, I am open sourcing everything.', 'published', ARRAY['x', 'linkedin']),
    (${randomUUID()}, ${userId}, 'demo', 'Demo: auth in 5 minutes', 'Full auth system — signup, login, password reset — in under 5 minutes.', 'idea', ARRAY['x'])
  `;
  console.log('Created 4 build items.');

  console.log('\n✓ seed:demo complete!');
  console.log('  Login: demo@example.com / demo1234');
  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
