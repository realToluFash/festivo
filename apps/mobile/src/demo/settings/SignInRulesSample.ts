import type { Area, Change, StandRules, StandViewer } from '../../kit/whereYouStand.ts';
import type { Load } from './RolesSample.ts';
import { YOU } from './sample.ts';

export const ORG = YOU.organisation;

/** The sample's today, so a day in this year is written without its year. */
export const NOW = new Date('2026-11-04T12:00');

/** What SignInRulesPage gives the page, and where the reader stands. Each change's `at` is the wall clock where the reader is; the sample has no zone of its own. */
export interface RulesPage {
  providerOnly: boolean;
  inactivityTimeoutDays: number | null;
  administratorsNeedTwoFactor: boolean;
  everyoneNeedsTwoFactor: boolean;
  twoFactorDeadline: string;
  inactivityLimit: { organisation: string; days: number } | null;
  ownTwoFactor: boolean;
  changes: readonly Change[];
}

/** Who is looking, from the session, the account's linked ways and signInRulesSeen. */
export interface RulesViewer {
  /** Their email, as Members keys a person. */
  id: string;
  role: string;
  manages: readonly Area[];
  /** organisation.manage: may change the rules, on the web. */
  setsRules: boolean;
  linked: 'Google' | 'Apple' | null;
  seen: string | null;
}

/** The page as the product's model reads it: a shortest limit that is this organisation's own is no limit from elsewhere. */
export function standRules(page: RulesPage): StandRules {
  const shortest = page.inactivityLimit;

  return {
    providerOnly: page.providerOnly,
    inactivityTimeoutDays: page.inactivityTimeoutDays,
    administratorsNeedTwoFactor: page.administratorsNeedTwoFactor,
    everyoneNeedsTwoFactor: page.everyoneNeedsTwoFactor,
    twoFactorDeadline: page.twoFactorDeadline,
    elsewhere: shortest != null && shortest.organisation !== ORG ? shortest : null,
    ownTwoFactor: page.ownTwoFactor,
  };
}

export function standViewer(viewer: RulesViewer): StandViewer {
  return {
    organisation: ORG,
    role: viewer.role,
    manages: viewer.manages,
    setsRules: viewer.setsRules,
    linked: viewer.linked,
  };
}

const BY = { name: YOU.name };

export const CHANGES: readonly Change[] = [
  { rule: 'administratorsNeedTwoFactor', now: true, was: false, at: '2026-10-28T15:12', by: BY },
  { rule: 'inactivityTimeoutDays', now: 30, was: null, at: '2026-09-01T10:05', by: BY },
];

const EVERYONE: Change = {
  rule: 'everyoneNeedsTwoFactor',
  now: true,
  was: false,
  at: '2026-11-04T09:40',
  by: BY,
};

const GOOGLE_ONLY: Change = {
  rule: 'providerOnly',
  now: true,
  was: false,
  at: '2026-11-02T11:20',
  by: BY,
};

const RULES: RulesPage = {
  providerOnly: false,
  inactivityTimeoutDays: 30,
  administratorsNeedTwoFactor: true,
  everyoneNeedsTwoFactor: false,
  twoFactorDeadline: '2026-11-11',
  inactivityLimit: { organisation: 'Lumen Studio', days: 7 },
  ownTwoFactor: true,
  changes: CHANGES,
};

const ONLY_HERE = { organisation: ORG, days: 30 };

const JULIEN: RulesViewer = {
  id: 'julien@ire.events',
  role: 'Admin',
  manages: ['members'],
  setsRules: true,
  linked: 'Google',
  seen: '2026-10-28T15:12',
};

const PRIYA: RulesViewer = {
  id: 'priya@ire.events',
  role: 'Member',
  manages: [],
  setsRules: false,
  linked: null,
  seen: '2026-10-28T15:12',
};

const ANA: RulesViewer = {
  id: 'ana.souza@ire.events',
  role: 'Member',
  manages: [],
  setsRules: false,
  linked: null,
  seen: '2026-10-28T15:12',
};

export const SIGN_IN_RULES_STATES = [
  'rules',
  'twoFactorDue',
  'notYours',
  'everyone',
  'googleOnly',
  'newChange',
  'noChanges',
  'loading',
  'failed',
] as const;

export type SignInRulesState = (typeof SIGN_IN_RULES_STATES)[number];

export function signInRulesStateOf(name: string | undefined): SignInRulesState {
  return SIGN_IN_RULES_STATES.find((state) => state === name) ?? 'rules';
}

export interface SignInRulesStart {
  load: Load;
  page: RulesPage;
  viewer: RulesViewer;
}

export function signInRulesStart(state: SignInRulesState): SignInRulesStart {
  const start = (
    page: Partial<RulesPage> = {},
    viewer: RulesViewer = JULIEN,
  ): SignInRulesStart => ({
    load: 'loaded',
    page: { ...RULES, ...page },
    viewer,
  });

  switch (state) {
    case 'twoFactorDue':
      return start({ ownTwoFactor: false });
    case 'notYours':
      return start({ ownTwoFactor: false, inactivityLimit: ONLY_HERE }, PRIYA);
    case 'everyone':
      return start({
        everyoneNeedsTwoFactor: true,
        ownTwoFactor: false,
        changes: [EVERYONE, ...CHANGES],
      });
    case 'googleOnly':
      return start(
        {
          providerOnly: true,
          ownTwoFactor: false,
          inactivityLimit: ONLY_HERE,
          changes: [GOOGLE_ONLY, ...CHANGES],
        },
        ANA,
      );
    case 'newChange':
      return start({}, { ...JULIEN, seen: '2026-09-01T10:05' });
    case 'noChanges':
      return start(
        { inactivityTimeoutDays: null, administratorsNeedTwoFactor: false, changes: [] },
        { ...JULIEN, seen: null },
      );
    case 'loading':
    case 'failed':
      return { ...start(), load: state };
    case 'rules':
      return start();
  }
}
