// i18n strings — all UI copy lives here.
// Usage: import { t } from '@/lib/strings'; t('key', user.settings.language)

import type { LimitedResource } from '@/lib/plans';

export const strings = {
  en: {
    // App
    appTitle: 'momentum',
    appDescription: 'Personal daily dashboard',

    // Nav sections
    navToday: 'today',
    navUni: 'uni',
    navWork: 'work',
    navFreelance: 'freelance',
    navProjects: 'projects',
    navCommunity: 'community',
    navBuild: 'build',

    // Today dashboard
    todayItems: 'pending items',
    todayClasses: 'classes',
    todayAssignments: 'upcoming assignments',
    todayWork: 'work',
    todayWorkTitle: 'work today',
    todayFacu: 'university today',
    todayBuild: 'build today',
    todayFreelance: 'active freelance',
    todayCommunity: 'upcoming commitments',
    todayNoClassesOrAssignments: 'no classes or urgent assignments today.',
    todayNoWorkblocks: 'no active workblocks.',
    todayNoData: 'nothing pending today — great!',
    todayGetStarted: 'add items from any section to see them here.',

    // Uni
    uniSection: 'uni',
    uniTitle: 'schedule',
    uniSubjects: 'subjects',
    uniAssignmentsActive: 'active assignments',
    uniNoSubjects: 'no subjects yet.',
    uniNoSubjectsHint: 'add your first subject to get started.',
    uniNoAssignments: 'no active assignments.',
    uniWeekSchedule: 'week',
    uniVaultPath: 'notes path',

    // Work
    workSection: 'work',
    workTitle: 'kanban',
    workNoWorkblocks: 'no workblocks yet.',
    workNoWorkblocksHint: 'add your first task to get started.',
    workClient: 'client',

    // Freelance
    freelanceSection: 'freelance',
    freelanceTitle: 'clients',
    freelanceNoClients: 'no clients yet.',
    freelanceNoClientsHint: 'add your first client to get started.',

    // Projects
    projectsSection: 'projects',
    projectsTitle: 'own projects',
    projectsNoProjects: 'no projects yet.',
    projectsNoProjectsHint: 'add your first project to get started.',

    // Community
    communitySection: 'community',
    communityTitle: 'commitments',
    communityNoPending: 'no pending commitments.',
    communityNoPendingHint: 'add one with the button above.',
    communityNoOrgs: 'no organizations yet.',

    // Build
    buildSection: 'build',
    buildTitle: 'build-in-public tracker',
    buildNoItems: 'no ideas or drafts yet.',
    buildNoItemsHint: 'add your first post idea to get started.',

    // Urgency labels (shared by assignment and community rows)
    urgencyOverdue: 'overdue',
    urgencyToday: 'today',
    urgencySoon: 'this week',
    urgencyLater: 'later',
    urgencyNone: 'no date',

    // Kanban / ticket status
    statusToday: 'today',

    // Today dashboard empty state
    todayAllClear: 'all clear',

    // Build prompt
    buildCapture: 'capture an idea now',
    buildNoPending: 'no ideas or drafts pending.',
    buildNoPendingHint: 'start capturing an idea above.',

    // Common
    noClient: 'no client',
    addOne: 'add one →',
    loading: 'loading…',

    // Auth — OAuth login
    authContinueWithGithub: 'continue with GitHub',
    authContinueWithGoogle: 'continue with Google',
    authOrDivider: 'or',
    authErrorOauthNotConfigured: 'this login method is not configured.',
    authErrorOauthDenied: 'access was denied.',
    authErrorOauthStateMismatch: 'your login session expired — try again.',
    authErrorSignupDisabled: 'sign-up is disabled — ask an admin for an invite.',
    authErrorAccountDisabled: 'this account is disabled.',
    authErrorOauthExchangeFailed: 'could not complete login with the provider.',
    authErrorOauthProfileFailed: 'could not fetch your profile from the provider.',
    authErrorOauthFailed: 'something went wrong — try again.',

    // Settings — connected accounts
    accountsTitle: 'connected accounts',
    accountsDescription: 'sign in with these providers without a password.',
    accountsConnect: 'connect',
    accountsDisconnect: 'disconnect',
    accountsConnected: 'connected',
    accountsNotConnected: 'not connected',
    accountsLastMethodError: 'you cannot disconnect your only login method.',
    accountsUnlinkConfirmTitle: 'disconnect account?',
    accountsUnlinkConfirmDescription: 'you will no longer be able to log in with this provider.',

    // Plans & limits
    planSection: 'plan',
    planCurrentPlan: 'current plan',
    planStatusLabel: 'status',
    planFree: 'free',
    planPro: 'pro',
    planStatusActive: 'active',
    planStatusPastDue: 'past due',
    planStatusCancelled: 'cancelled',
    planUsage: 'usage',
    planSelfHosted: 'self-hosted — unlimited',
    planUpgrade: 'upgrade',
    planUpgradeComingSoon: 'upgrading to pro is coming soon.',
    planUnlimited: 'unlimited',
    limitReachedTemplate: "you've reached your plan's limit of {limit} {resource}. upgrade to pro for unlimited.",
    resourceAssignments: 'assignments',
    resourceWorkblocks: 'workblocks',
    resourceBuildItems: 'build items',
    resourceFreelanceClients: 'freelance clients',
    resourceFreelanceTasks: 'freelance tasks',
    resourceOwnProjects: 'projects',
    resourceOrganizations: 'organizations',
    resourceCommunityItems: 'community items',
    resourceApiTokens: 'API tokens',

    // Onboarding — welcome modal
    onboardingWelcomeTitle: 'welcome to momentum',
    onboardingWelcomeDescription: 'your daily operating dashboard, organized around 7 pillars. add items to any of them and they\'ll show up in your Today view.',
    onboardingPillarsTitle: 'the 7 pillars',
    onboardingPillarToday: 'your daily aggregator — assignments, tickets, and build queue in one place.',
    onboardingPillarUni: 'subjects, schedules, and assignments.',
    onboardingPillarWork: 'kanban board for work tasks.',
    onboardingPillarFreelance: 'clients and their task lists.',
    onboardingPillarProjects: 'your own side projects.',
    onboardingPillarCommunity: 'commitments and events you said yes to.',
    onboardingPillarBuild: 'ideas → drafts → published posts.',
    onboardingGetStarted: "let's go",
    onboardingVaultCta: 'have an Obsidian vault? import it via the MCP server →',

    // Sample data
    sampleDataTitle: 'sample data',
    sampleDataDescription: 'load a set of example items across all 7 pillars to explore momentum before adding your own data. fully reversible — remove it anytime.',
    sampleDataLoad: 'load sample data',
    sampleDataRemove: 'remove sample data',
    sampleDataLoaded: 'sample data loaded — check out each section.',
    sampleDataLoadedPartial: 'sample data loaded — some items were skipped because of your plan limits.',
    sampleDataAlreadyLoaded: 'sample data is already loaded.',
    sampleDataRemoved: 'sample data removed.',
    sampleDataRemoveConfirmTitle: 'remove sample data?',
    sampleDataRemoveConfirmDescription: 'this deletes all sample items added by "load sample data". your own data is never affected.',
  },
  es: {
    // App
    appTitle: 'momentum',
    appDescription: 'Dashboard personal diario',

    // Nav sections
    navToday: 'hoy',
    navUni: 'uni',
    navWork: 'trabajo',
    navFreelance: 'freelance',
    navProjects: 'proyectos',
    navCommunity: 'comunidad',
    navBuild: 'build',

    // Today dashboard
    todayItems: 'items pendientes',
    todayClasses: 'clases',
    todayAssignments: 'TPs próximos',
    todayWork: 'trabajo',
    todayWorkTitle: 'trabajo hoy',
    todayFacu: 'hoy en la facu',
    todayBuild: 'build hoy',
    todayFreelance: 'freelance activo',
    todayCommunity: 'compromisos próximos',
    todayNoClassesOrAssignments: 'no hay clases ni TPs urgentes hoy.',
    todayNoWorkblocks: 'no hay workblocks activos.',
    todayNoData: '¡nada pendiente hoy — genial!',
    todayGetStarted: 'agregá items desde cualquier sección para verlos acá.',

    // Uni
    uniSection: 'uni',
    uniTitle: 'agenda',
    uniSubjects: 'materias',
    uniAssignmentsActive: 'TPs activos',
    uniNoSubjects: 'no hay materias cargadas.',
    uniNoSubjectsHint: 'agregá tu primera materia para empezar.',
    uniNoAssignments: 'no hay TPs activos.',
    uniWeekSchedule: 'semana',
    uniVaultPath: 'ruta de notas',

    // Work
    workSection: 'trabajo',
    workTitle: 'kanban',
    workNoWorkblocks: 'no hay workblocks todavía.',
    workNoWorkblocksHint: 'agregá tu primera tarea para empezar.',
    workClient: 'cliente',

    // Freelance
    freelanceSection: 'freelance',
    freelanceTitle: 'clientes',
    freelanceNoClients: 'no hay clientes todavía.',
    freelanceNoClientsHint: 'agregá tu primer cliente para empezar.',

    // Projects
    projectsSection: 'proyectos',
    projectsTitle: 'proyectos propios',
    projectsNoProjects: 'no hay proyectos todavía.',
    projectsNoProjectsHint: 'agregá tu primer proyecto para empezar.',

    // Community
    communitySection: 'comunidad',
    communityTitle: 'compromisos',
    communityNoPending: 'no hay compromisos pendientes.',
    communityNoPendingHint: 'agregá uno con el botón de arriba.',
    communityNoOrgs: 'no hay organizaciones todavía.',

    // Build
    buildSection: 'build',
    buildTitle: 'tracker build-in-public',
    buildNoItems: 'no hay ideas ni drafts todavía.',
    buildNoItemsHint: 'agregá tu primera idea de post para empezar.',

    // Urgency labels (shared by assignment and community rows)
    urgencyOverdue: 'vencido',
    urgencyToday: 'hoy',
    urgencySoon: 'esta semana',
    urgencyLater: 'después',
    urgencyNone: 'sin fecha',

    // Kanban / ticket status
    statusToday: 'hoy',

    // Today dashboard empty state
    todayAllClear: 'todo en orden',

    // Build prompt
    buildCapture: 'capturá una idea ahora',
    buildNoPending: 'sin ideas ni drafts pendientes.',
    buildNoPendingHint: 'empezá capturando una idea arriba.',

    // Common
    noClient: 'sin cliente',
    addOne: 'agregar →',
    loading: 'cargando…',

    // Auth — OAuth login
    authContinueWithGithub: 'continuar con GitHub',
    authContinueWithGoogle: 'continuar con Google',
    authOrDivider: 'o',
    authErrorOauthNotConfigured: 'este método de acceso no está configurado.',
    authErrorOauthDenied: 'se denegó el acceso.',
    authErrorOauthStateMismatch: 'tu sesión de login expiró — intentá de nuevo.',
    authErrorSignupDisabled: 'el registro está deshabilitado — pedile una invitación a un admin.',
    authErrorAccountDisabled: 'esta cuenta está deshabilitada.',
    authErrorOauthExchangeFailed: 'no se pudo completar el login con el proveedor.',
    authErrorOauthProfileFailed: 'no se pudo obtener tu perfil del proveedor.',
    authErrorOauthFailed: 'algo salió mal — intentá de nuevo.',

    // Settings — connected accounts
    accountsTitle: 'cuentas conectadas',
    accountsDescription: 'iniciá sesión con estos proveedores sin contraseña.',
    accountsConnect: 'conectar',
    accountsDisconnect: 'desconectar',
    accountsConnected: 'conectado',
    accountsNotConnected: 'no conectado',
    accountsLastMethodError: 'no podés desconectar tu único método de acceso.',
    accountsUnlinkConfirmTitle: '¿desconectar cuenta?',
    accountsUnlinkConfirmDescription: 'no vas a poder iniciar sesión con este proveedor.',

    // Plans & limits
    planSection: 'plan',
    planCurrentPlan: 'plan actual',
    planStatusLabel: 'estado',
    planFree: 'free',
    planPro: 'pro',
    planStatusActive: 'activo',
    planStatusPastDue: 'pago vencido',
    planStatusCancelled: 'cancelado',
    planUsage: 'uso',
    planSelfHosted: 'self-hosted — ilimitado',
    planUpgrade: 'mejorar plan',
    planUpgradeComingSoon: 'la opción de mejorar a pro estará disponible pronto.',
    planUnlimited: 'ilimitado',
    limitReachedTemplate: 'alcanzaste el límite de tu plan: {limit} {resource}. actualizá a pro para tener ilimitado.',
    resourceAssignments: 'TPs',
    resourceWorkblocks: 'tickets',
    resourceBuildItems: 'posts de build',
    resourceFreelanceClients: 'clientes freelance',
    resourceFreelanceTasks: 'tareas freelance',
    resourceOwnProjects: 'proyectos',
    resourceOrganizations: 'organizaciones',
    resourceCommunityItems: 'compromisos',
    resourceApiTokens: 'tokens de API',

    // Onboarding — welcome modal
    onboardingWelcomeTitle: 'bienvenido a momentum',
    onboardingWelcomeDescription: 'tu dashboard operacional diario, organizado en 7 pilares. agregá items en cualquiera de ellos y van a aparecer en tu vista Today.',
    onboardingPillarsTitle: 'los 7 pilares',
    onboardingPillarToday: 'tu agregador diario — TPs, tickets y cola de build en un solo lugar.',
    onboardingPillarUni: 'materias, horarios y TPs.',
    onboardingPillarWork: 'kanban para tareas de trabajo.',
    onboardingPillarFreelance: 'clientes y sus listas de tareas.',
    onboardingPillarProjects: 'tus proyectos propios.',
    onboardingPillarCommunity: 'compromisos y eventos a los que dijiste que sí.',
    onboardingPillarBuild: 'ideas → drafts → posts publicados.',
    onboardingGetStarted: 'empezar',
    onboardingVaultCta: '¿tenés un vault de Obsidian? importalo vía el servidor MCP →',

    // Sample data
    sampleDataTitle: 'datos de ejemplo',
    sampleDataDescription: 'cargá un set de items de ejemplo en los 7 pilares para explorar momentum antes de agregar tus propios datos. totalmente reversible — quitalos cuando quieras.',
    sampleDataLoad: 'cargar datos de ejemplo',
    sampleDataRemove: 'quitar datos de ejemplo',
    sampleDataLoaded: 'datos de ejemplo cargados — recorré cada sección.',
    sampleDataLoadedPartial: 'datos de ejemplo cargados — algunos items se omitieron por el límite de tu plan.',
    sampleDataAlreadyLoaded: 'los datos de ejemplo ya están cargados.',
    sampleDataRemoved: 'datos de ejemplo eliminados.',
    sampleDataRemoveConfirmTitle: '¿quitar datos de ejemplo?',
    sampleDataRemoveConfirmDescription: 'esto elimina todos los items de ejemplo agregados por "cargar datos de ejemplo". tus propios datos nunca se ven afectados.',
  },
} as const;

export type Lang = 'en' | 'es';
export type StringKey = keyof typeof strings.en;

const OAUTH_ERROR_KEYS: Record<string, StringKey> = {
  oauth_not_configured: 'authErrorOauthNotConfigured',
  oauth_denied: 'authErrorOauthDenied',
  oauth_state_mismatch: 'authErrorOauthStateMismatch',
  signup_disabled: 'authErrorSignupDisabled',
  account_disabled: 'authErrorAccountDisabled',
  oauth_exchange_failed: 'authErrorOauthExchangeFailed',
  oauth_profile_failed: 'authErrorOauthProfileFailed',
  oauth_failed: 'authErrorOauthFailed',
};

/** Maps an `?error=` query param from the OAuth callback to a localized message, or null if unrecognized. */
export function oauthErrorMessage(code: string | undefined, lang: Lang = 'en'): string | null {
  if (!code) return null;
  const key = OAUTH_ERROR_KEYS[code];
  return key ? t(key, lang) : null;
}

export function t(key: StringKey, lang: Lang = 'en'): string {
  return strings[lang][key] ?? strings.en[key];
}

const RESOURCE_LABEL_KEYS: Record<LimitedResource, StringKey> = {
  assignments: 'resourceAssignments',
  workblocks: 'resourceWorkblocks',
  build_items: 'resourceBuildItems',
  freelance_clients: 'resourceFreelanceClients',
  freelance_tasks: 'resourceFreelanceTasks',
  own_projects: 'resourceOwnProjects',
  organizations: 'resourceOrganizations',
  community_items: 'resourceCommunityItems',
  api_tokens: 'resourceApiTokens',
};

/** Friendly message for a `{ error: 'limit_reached', resource, limit }` result from a create action. */
export function limitReachedMessage(error: { resource: LimitedResource; limit: number }, lang: Lang = 'es'): string {
  const resourceLabel = t(RESOURCE_LABEL_KEYS[error.resource], lang);
  return t('limitReachedTemplate', lang)
    .replace('{limit}', String(error.limit))
    .replace('{resource}', resourceLabel);
}
