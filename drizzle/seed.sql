-- Seed inicial — materias UCEMA del semestre 2026-1.
-- Correr una vez tras `drizzle-kit push` o la migración inicial.

insert into subjects (name, semester, vault_slug, active)
values
  ('Administración de Recursos Humanos', '2026-1', 'administracion-rrhh', true),
  ('Analítica Digital', '2026-1', 'analitica-digital', true),
  ('Control de Gestión', '2026-1', 'control-de-gestion', true),
  ('Fintech', '2026-1', 'fintech', true),
  ('Taller de Gestión de Carrera', '2026-1', 'taller-gestion-carrera', true)
on conflict do nothing;
