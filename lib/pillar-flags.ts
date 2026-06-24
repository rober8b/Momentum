// Rollback flags for the dynamic pillar migration — flip the env var to
// revert a cut-over route to its legacy table instantly, no code revert.
// See docs/DYNAMIC_PILLARS.md, "migration strategy: rollback is a flag,
// not a revert." Defaults to the new path; set the var to 'false' to fall
// back to the legacy own_projects-backed /projects route.
export function isProjectsDynamicEngineEnabled(): boolean {
  return process.env.PROJECTS_DYNAMIC_ENGINE !== 'false';
}

// Set FREELANCE_DYNAMIC_ENGINE=false to fall back to the legacy
// freelance_clients/freelance_tasks-backed /freelance routes instantly.
export function isFreelanceDynamicEngineEnabled(): boolean {
  return process.env.FREELANCE_DYNAMIC_ENGINE !== 'false';
}

// Set COMMUNITY_DYNAMIC_ENGINE=false to fall back to the legacy
// organizations/community_items-backed /community route instantly.
export function isCommunityDynamicEngineEnabled(): boolean {
  return process.env.COMMUNITY_DYNAMIC_ENGINE !== 'false';
}

// Set UNI_DYNAMIC_ENGINE=false to fall back to the legacy
// subjects/assignments-backed /uni routes instantly. Note: /uni/[subject]/
// [assignment] (the resources detail page) is NOT gated by this flag — it
// always reads the legacy tables directly, since the dynamic engine has no
// child-item detail route yet. See docs/DYNAMIC_PILLARS.md.
export function isUniDynamicEngineEnabled(): boolean {
  return process.env.UNI_DYNAMIC_ENGINE !== 'false';
}
