// i18n strings — all UI copy lives here.
// Usage: import { t } from '@/lib/strings'; t('key', user.settings.language)

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
