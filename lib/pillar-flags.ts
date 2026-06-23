// Rollback flags for the dynamic pillar migration — flip the env var to
// revert a cut-over route to its legacy table instantly, no code revert.
// See docs/DYNAMIC_PILLARS.md, "migration strategy: rollback is a flag,
// not a revert." Defaults to the new path; set the var to 'false' to fall
// back to the legacy own_projects-backed /projects route.
export function isProjectsDynamicEngineEnabled(): boolean {
  return process.env.PROJECTS_DYNAMIC_ENGINE !== 'false';
}
