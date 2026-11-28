/** sc-3930: a plan's hard limit, or the ceiling, refused where the work is made, as LimitReached.dc.html draws it. */

export const LIMITS = [
  'liveEvents',
  'guestAdded',
  'guestImport',
  'seatInvite',
  'seatAccept',
  'ceilingGuest',
  'ceilingImport',
] as const;

export type Limit = (typeof LIMITS)[number];

export type Role = 'manage' | 'other';

export type Owners = 'one' | 'several';

export type Ask =
  { now: 'ready' } | { now: 'sending' } | { now: 'notSent' } | { now: 'sent'; owners: Owners };

export const ORGANISATION = 'Ìrè Events';
export const PLAN = 'Free';
export const CEILING = 10_000;

export const SAMPLE = {
  live: { used: 2, allowed: 2 },
  /** Among the events the limit counts, the one whose end comes first, in its own time zone. */
  firstToEnd: { name: 'Summer gala', endsAt: '2026-12-12T23:00:00Z', timeZone: 'Europe/London' },
  guestAdded: { on: 100, allowed: 100 },
  guestImport: { on: 62, allowed: 100, inFile: 50 },
  seats: { used: 3, allowed: 3 },
  ceilingGuest: { on: CEILING },
  ceilingImport: { on: 9_820, inFile: 420 },
} as const;

const NUMBER = new Intl.NumberFormat('en-GB');

export function figure(count: number): string {
  return NUMBER.format(count);
}

const one = (count: number, single: string, many: string): string => (count === 1 ? single : many);

export function endOf(endsAt: string, timeZone: string): { date: string; time: string } {
  const at = new Date(endsAt);
  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(at);

  return { date, time };
}

/** The board's English, from The refusal and its dated sections. Lines no AC words are the drawing's, for [en]. */
export const LW = {
  liveTitle: (count: number) =>
    one(
      count,
      `Your plan allows ${figure(count)} live event at once`,
      `Your plan allows ${figure(count)} live events at once`,
    ),
  peopleTitle: (count: number) =>
    one(
      count,
      `Your plan allows ${figure(count)} person per event`,
      `Your plan allows ${figure(count)} people per event`,
    ),
  seatsTitle: (count: number) =>
    one(
      count,
      `Your plan allows ${figure(count)} team seat`,
      `Your plan allows ${figure(count)} team seats`,
    ),
  acceptTitle: (organisation: string) => `Every team seat at ${organisation} is in use`,
  ceilingTitle: (ceiling: number) => `An event can have up to ${figure(ceiling)} people`,
  liveFigure: (used: number, allowed: number, plan: string) =>
    `${figure(used)} of ${figure(allowed)} live events · ${plan} plan`,
  peopleFigure: (on: number, allowed: number, plan: string) =>
    `${figure(on)} of ${figure(allowed)} people · companions count as people · ${plan} plan`,
  importFigure: (on: number, allowed: number, plan: string) =>
    `${figure(on)} of ${figure(allowed)} people · companions in the file count as people · ${plan} plan`,
  seatsFigure: (used: number, allowed: number, plan: string) =>
    `${figure(used)} of ${figure(allowed)} team seats · ${plan} plan`,
  ceilingFigure: (on: number, ceiling: number) =>
    `${figure(on)} of ${figure(ceiling)} people · companions count as people`,
  ceilingImportFigure: (on: number, ceiling: number) =>
    `${figure(on)} of ${figure(ceiling)} people · companions in the file count as people`,
  guestFull: (on: number) => `This event already has ${figure(on)} people.`,
  importOver: (inFile: number, room: number) =>
    `Nothing was imported. The file has ${figure(inFile)} people, and this event has room for ${figure(room)} more.`,
  liveKept: 'Kept as a draft, with everything you entered.',
  formKept: 'The form is kept as you left it.',
  fileKept: 'The file is kept as it was. Nothing is lost.',
  inviteKept: 'The invitation is kept as you wrote it.',
  acceptKept: 'Your invitation stays open. Nothing is lost.',
  goLive: (event: string, date: string, time: string) =>
    `Another event can go live when ${event} ends, on ${date} at ${time}.`,
  removeGuest: 'Remove a guest',
  removeGuestLine: 'Each guest removed, with their companion places, makes room.',
  toGuestList: 'Go to the guest list',
  withdraw: 'Withdraw an invitation',
  withdrawLine: 'An invitation not yet accepted holds a seat.',
  removeMember: 'Remove a member',
  removeMemberLine: 'A member removed frees their seat.',
  enterpriseLive: 'Enterprise has no limit on live events.',
  enterprisePeople: 'Enterprise has no limit on people per event.',
  enterpriseSeats: 'Enterprise has no limit on team seats.',
  changePlan: 'Change plan',
  askOwner: 'Ask an owner',
  sent: {
    one: 'The owner has been sent the link to Compare plans.',
    several: 'The owners have been sent the link to Compare plans.',
  },
  notSent: 'Not sent. Try again in a moment.',
  inApp: 'The plan cannot be changed in the app.',
  back: {
    liveEvents: 'Back to the draft',
    guestAdded: 'Back to the form',
    guestImport: 'Back to the import',
    seatInvite: 'Back to the invitation',
    seatAccept: 'Not now',
    ceilingGuest: 'Back to the form',
    ceilingImport: 'Back to the import',
  } satisfies Record<Limit, string>,
} as const;

export type Way = 'goLive' | 'removeGuest' | 'withdraw' | 'removeMember';

export interface Refusal {
  title: string;
  line: string | null;
  figure: string | null;
  safe: string;
  ways: readonly Way[];
  plan: { enterprise: string | null } | null;
  /** Ask an owner whatever the role: an invitee holds no permission yet. */
  asksAlways: boolean;
  back: string;
}

export function refusalOf(limit: Limit): Refusal {
  switch (limit) {
    case 'liveEvents':
      return {
        title: LW.liveTitle(SAMPLE.live.allowed),
        line: null,
        figure: LW.liveFigure(SAMPLE.live.used, SAMPLE.live.allowed, PLAN),
        safe: LW.liveKept,
        ways: ['goLive'],
        plan: { enterprise: LW.enterpriseLive },
        asksAlways: false,
        back: LW.back.liveEvents,
      };
    case 'guestAdded':
      return {
        title: LW.peopleTitle(SAMPLE.guestAdded.allowed),
        line: LW.guestFull(SAMPLE.guestAdded.on),
        figure: LW.peopleFigure(SAMPLE.guestAdded.on, SAMPLE.guestAdded.allowed, PLAN),
        safe: LW.formKept,
        ways: ['removeGuest'],
        plan: { enterprise: LW.enterprisePeople },
        asksAlways: false,
        back: LW.back.guestAdded,
      };
    case 'guestImport':
      return {
        title: LW.peopleTitle(SAMPLE.guestImport.allowed),
        line: LW.importOver(
          SAMPLE.guestImport.inFile,
          SAMPLE.guestImport.allowed - SAMPLE.guestImport.on,
        ),
        figure: LW.importFigure(SAMPLE.guestImport.on, SAMPLE.guestImport.allowed, PLAN),
        safe: LW.fileKept,
        ways: ['removeGuest'],
        plan: { enterprise: LW.enterprisePeople },
        asksAlways: false,
        back: LW.back.guestImport,
      };
    case 'seatInvite':
      return {
        title: LW.seatsTitle(SAMPLE.seats.allowed),
        line: null,
        figure: LW.seatsFigure(SAMPLE.seats.used, SAMPLE.seats.allowed, PLAN),
        safe: LW.inviteKept,
        ways: ['withdraw', 'removeMember'],
        plan: { enterprise: LW.enterpriseSeats },
        asksAlways: false,
        back: LW.back.seatInvite,
      };
    case 'seatAccept':
      return {
        title: LW.acceptTitle(ORGANISATION),
        line: null,
        figure: null,
        safe: LW.acceptKept,
        ways: [],
        plan: { enterprise: null },
        asksAlways: true,
        back: LW.back.seatAccept,
      };
    case 'ceilingGuest':
      return {
        title: LW.ceilingTitle(CEILING),
        line: LW.guestFull(SAMPLE.ceilingGuest.on),
        figure: LW.ceilingFigure(SAMPLE.ceilingGuest.on, CEILING),
        safe: LW.formKept,
        ways: ['removeGuest'],
        plan: null,
        asksAlways: false,
        back: LW.back.ceilingGuest,
      };
    case 'ceilingImport':
      return {
        title: LW.ceilingTitle(CEILING),
        line: LW.importOver(SAMPLE.ceilingImport.inFile, CEILING - SAMPLE.ceilingImport.on),
        figure: LW.ceilingImportFigure(SAMPLE.ceilingImport.on, CEILING),
        safe: LW.fileKept,
        ways: ['removeGuest'],
        plan: null,
        asksAlways: false,
        back: LW.back.ceilingImport,
      };
  }
}

export function planWayOf(refusal: Refusal, role: Role): 'change' | 'ask' | null {
  if (refusal.plan == null) return null;
  if (refusal.asksAlways) return 'ask';
  return role === 'manage' ? 'change' : 'ask';
}

/** A press sends only from Ask an owner as it stands or after Not sent; a second press while sending sends nothing. */
export function mayAsk(ask: Ask): boolean {
  return ask.now === 'ready' || ask.now === 'notSent';
}

/** The answer the demo plays: offline goes Not sent; otherwise the link goes to the sample's owners, never named. */
export function answerOf(offline: boolean, owners: Owners): Ask {
  return offline ? { now: 'notSent' } : { now: 'sent', owners };
}

export function refusedOn(limit: Limit): string {
  switch (limit) {
    case 'liveEvents':
      return 'Event view · Make live';
    case 'guestAdded':
    case 'ceilingGuest':
      return 'Guests · Add guest';
    case 'guestImport':
    case 'ceilingImport':
      return 'Guests · Import';
    case 'seatInvite':
      return 'Members · Invite';
    case 'seatAccept':
      return `Join ${ORGANISATION}`;
  }
}

export interface LimitState {
  limit: Limit;
  role: Role;
  ask: Ask;
}

const STATES = {
  liveManage: { limit: 'liveEvents', role: 'manage', ask: { now: 'ready' } },
  liveOther: { limit: 'liveEvents', role: 'other', ask: { now: 'ready' } },
  liveSending: { limit: 'liveEvents', role: 'other', ask: { now: 'sending' } },
  liveSentOne: { limit: 'liveEvents', role: 'other', ask: { now: 'sent', owners: 'one' } },
  liveSentSeveral: {
    limit: 'liveEvents',
    role: 'other',
    ask: { now: 'sent', owners: 'several' },
  },
  liveNotSent: { limit: 'liveEvents', role: 'other', ask: { now: 'notSent' } },
  guestManage: { limit: 'guestAdded', role: 'manage', ask: { now: 'ready' } },
  guestOther: { limit: 'guestAdded', role: 'other', ask: { now: 'ready' } },
  importManage: { limit: 'guestImport', role: 'manage', ask: { now: 'ready' } },
  importOther: { limit: 'guestImport', role: 'other', ask: { now: 'ready' } },
  inviteManage: { limit: 'seatInvite', role: 'manage', ask: { now: 'ready' } },
  inviteOther: { limit: 'seatInvite', role: 'other', ask: { now: 'ready' } },
  accept: { limit: 'seatAccept', role: 'other', ask: { now: 'ready' } },
  acceptSent: { limit: 'seatAccept', role: 'other', ask: { now: 'sent', owners: 'several' } },
  ceilingGuest: { limit: 'ceilingGuest', role: 'manage', ask: { now: 'ready' } },
  ceilingImport: { limit: 'ceilingImport', role: 'other', ask: { now: 'ready' } },
} as const satisfies Record<string, LimitState>;

export type LimitStateName = keyof typeof STATES;

export function limitStateOf(name: string | null): LimitStateName {
  return name != null && name in STATES ? (name as LimitStateName) : 'liveManage';
}

export function limitState(name: LimitStateName): LimitState {
  return STATES[name];
}

const at = (state: LimitStateName, name: string) => ({
  to: `limit-reached?state=${state}`,
  name,
});

export const LIMIT_PAGES: readonly {
  name: string;
  states: readonly { to: string; name: string }[];
}[] = [
  {
    name: 'Live events at once, over Make live',
    states: [
      at('liveManage', 'billing.manage: Change plan'),
      at('liveOther', 'Anyone else: Ask an owner (Play: sending, then sent)'),
      at('liveSending', 'Ask an owner, sending'),
      at('liveSentOne', 'Ask an owner, sent to the one owner'),
      at('liveSentSeveral', 'Ask an owner, sent to the owners'),
      at('liveNotSent', 'Ask an owner, not sent'),
    ],
  },
  {
    name: 'People per event, over Guests',
    states: [
      at('guestManage', 'A guest added, billing.manage'),
      at('guestOther', 'A guest added, anyone else'),
      at('importManage', 'An import, billing.manage'),
      at('importOther', 'An import, anyone else'),
    ],
  },
  {
    name: 'Team seats, over Members and Join',
    states: [
      at('inviteManage', 'An invitation sent, billing.manage'),
      at('inviteOther', 'An invitation sent, anyone else'),
      at('accept', 'An invitation accepted: Ask an owner and Not now'),
      at('acceptSent', 'An invitation accepted, the owners sent the link'),
    ],
  },
  {
    name: 'The ceiling of 10,000 people, any plan and any role',
    states: [
      at('ceilingGuest', 'A guest added past the ceiling'),
      at('ceilingImport', 'An import past the ceiling'),
    ],
  },
];
