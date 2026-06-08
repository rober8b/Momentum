// i18n strings — all UI copy lives here.
// Usage: import { t } from '@/lib/strings'; t('key', user.settings.language)

export const strings = {
  en: {
    // App
    appTitle: 'command center',
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

    // Common
    noClient: 'no client',
    addOne: 'add one →',
    loading: 'loading…',
  },
  es: {
    // App
    appTitle: 'command center',
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

    // Common
    noClient: 'sin cliente',
    addOne: 'agregar →',
    loading: 'cargando…',
  },
} as const;

export type Lang = 'en' | 'es';
export type StringKey = keyof typeof strings.en;

export function t(key: StringKey, lang: Lang = 'en'): string {
  return strings[lang][key] ?? strings.en[key];
}
