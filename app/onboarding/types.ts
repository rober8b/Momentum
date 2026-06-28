export type OnboardingContext = 'student' | 'developer' | 'freelancer' | 'builder' | 'mix';

export type OnboardingArea = 'work' | 'uni' | 'freelance' | 'projects' | 'community' | 'build';

export type SubjectCount = 'low' | 'mid' | 'high'; // 1-2 / 3-4 / 5+

export type ClientCount = 'one' | 'few' | 'many'; // 1 / 2-3 / 4+

export type OnboardingDetail = {
  subjectCount?: SubjectCount;
  clientCount?: ClientCount;
};

export type OnboardingAnswers = {
  context: OnboardingContext;
  areas: OnboardingArea[];
  detail: OnboardingDetail;
};

// ---------- Proposed / Confirmed structure (inference → preview → materialize) ----------

export type ProposedItem = {
  title: string;
  status: string;
  fields: Record<string, unknown>;
  is_container: boolean;
  children: ProposedItem[]; // only populated when is_container === true
};

export type ProposedPillar = {
  templateKey: OnboardingArea; // matches PILLAR_TEMPLATES key
  items: ProposedItem[];
};

export type ProposedStructure = {
  pillars: ProposedPillar[];
};

// ConfirmedStructure = user-edited copy of ProposedStructure sent to materializeOnboarding
export type ConfirmedItem = ProposedItem;
export type ConfirmedPillar = ProposedPillar;
export type ConfirmedStructure = ProposedStructure;
