import type { MarkKind } from '../components/SettingsParts.tsx';
import { emailProblem, type MemberStanding, memberStanding } from '@soirely/domain';

import {
  type AskWords,
  type Handed,
  handedOver,
  HANDOVER_WORDS as H,
  type HandStart,
  handStart,
  type Leads,
  ledByLine,
  LONG_NAMED,
} from './handover.ts';
import en from '../i18n/locales/en.json';
import { SAMPLE } from './rules.ts';
import { type SettingsSay, type Viewer, VIEWERS } from './settings.ts';
import { fold } from '../components/orgMenu.ts';

export const ORGANISATION = SAMPLE.organisation;
export const DOMAIN = 'ire.events';
export const TODAY = '2026-11-04';

export type Status = 'active' | 'pendingApproval' | 'suspended' | 'domainSuspended' | 'former';

export interface Step {
  what: string;
  when: string;
  by?: string;
}

export interface Person {
  id: string;
  name: string;
  initials: string;
  role: string | null;
  status: Status;
  gone: 'left' | 'removed' | null;
  tone: number;
  history: Step[];
}

const FOLAKE = VIEWERS.folake.id;
const JULIEN = VIEWERS.julien.id;
export const PRIYA = 'priya@ire.events';
export const ANA = VIEWERS.ana.id;
export const MARTA = 'marta.silva@ire.events';
export const LUCIA = 'lucia.gomez@outlook.com';
const DANIEL = 'daniel.kim@ire.events';
export const TOM = 'tom.becker@gmail.com';
export const KOFI = 'kofi@ire.events';

function person(
  id: string,
  name: string,
  role: string | null,
  history: Step[],
  status: Status = 'active',
): Omit<Person, 'tone'> {
  return {
    id,
    name,
    initials: name
      .split(' ')
      .map((word) => word[0])
      .join(''),
    role,
    status,
    gone: status === 'former' ? 'left' : null,
    history,
  };
}

export function samplePeople(): Person[] {
  return [
    person(FOLAKE, SAMPLE.name, 'Owner', [{ what: `Created ${ORGANISATION}`, when: '2025-03-02' }]),
    person(JULIEN, 'Julien Moreau', 'Admin', [
      { what: 'Invited by', by: FOLAKE, when: '2025-04-12' },
      { what: 'Accepted the invitation', when: '2025-04-14' },
    ]),
    person(PRIYA, 'Priya Shah', 'Member', [
      { what: 'Joined with a company email address', when: '2025-06-03' },
    ]),
    person(ANA, 'Ana Souza', 'Member', [{ what: 'Joined with a join code', when: '2025-08-21' }]),
    person(TOM, 'Tom Becker', 'Member', [
      { what: 'Asked to join', when: '2026-02-06' },
      { what: 'Approved by', by: FOLAKE, when: '2026-02-09' },
    ]),
    person(KOFI, 'Kofi Mensah', 'Member', [
      { what: 'Joined from the company directory', when: '2026-09-15' },
    ]),
    person(
      MARTA,
      'Marta Silva',
      'Member',
      [
        { what: 'Joined with a company email address', when: '2026-05-11' },
        { what: 'Suspended: company domain', when: '2026-10-28' },
      ],
      'domainSuspended',
    ),
    person(
      LUCIA,
      'Lucía Gómez',
      null,
      [{ what: 'Asked to join', when: '2026-11-02' }],
      'pendingApproval',
    ),
    person(
      DANIEL,
      'Daniel Kim',
      'Member',
      [{ what: `Left ${ORGANISATION}`, when: '2026-09-30' }],
      'former',
    ),
  ].map((one, tone) => ({ ...one, tone }));
}

const MORE = [
  'Joana Ferreira',
  'Jonas Weber',
  'João Pereira',
  'Amara Okafor',
  'Chen Wei',
  'Sofía Herrera',
  'Lars Nilsson',
  'Aisha Bello',
  'Mateo Rossi',
  'Hana Sato',
  'Pierre Lambert',
] as const;

/** Eleven more members, for the person menu's search above 15 (sc-614). */
export function morePeople(): Person[] {
  return MORE.map((name, index) => ({
    ...person(`${fold(name.split(' ')[0] ?? name)}@ire.events`, name, 'Member', [
      { what: 'Joined with a join code', when: '2026-10-05' },
    ]),
    tone: index + 9,
  }));
}

const EVENT = {
  wed: 'evt-wed-4',
  ireti: 'evt-ireti-2',
  gala: 'evt-gala-4',
  party: 'evt-party-2',
  cena: 'evt-cena-4',
  draft: 'evt-draft-4',
  off: 'evt-off',
  mtl: 'evt-mtl-3',
} as const;

/** Lead on an event, the one kind of work a member has (sc-614): Priya leads 3, Ana 2, Marta 2. */
export function sampleLeads(): Leads {
  return {
    [PRIYA]: [EVENT.wed, EVENT.ireti, EVENT.off],
    [ANA]: [EVENT.gala, EVENT.mtl],
    [MARTA]: [EVENT.party, EVENT.cena],
  };
}

export interface Invitation {
  email: string;
  role: string;
  by: string;
  status: 'pending' | 'expired' | 'revoked' | 'declined';
  sent: string;
  ended: string;
  /** Its latest send failed, was held back for a suppressed address, or hard-bounced (sc-46109); the field's name is dev's. */
  notDelivered?: boolean;
}

export function sampleInvitations(): Invitation[] {
  return [
    {
      email: 'nnamdi.eze@ire.events',
      role: 'Member',
      by: FOLAKE,
      status: 'pending',
      sent: '2026-11-02',
      ended: '2026-11-09',
    },
    {
      email: 'sofia.ramos@gmail.com',
      role: 'Member',
      by: JULIEN,
      status: 'expired',
      sent: '2026-10-12',
      ended: '2026-10-19',
    },
    {
      email: 'kwame.asante@outlook.com',
      role: 'Admin',
      by: FOLAKE,
      status: 'declined',
      sent: '2026-09-28',
      ended: '2026-09-30',
    },
  ];
}

/** Every reading of an invitation whose email never arrived (sc-46109), after one that did. */
export function undeliveredInvitations(): Invitation[] {
  return [
    {
      email: 'nnamdi.eze@ire.events',
      role: 'Member',
      by: FOLAKE,
      status: 'pending',
      sent: '2026-11-02',
      ended: '2026-11-09',
    },
    {
      email: 'ada.obi@ire.events',
      role: 'Member',
      by: JULIEN,
      status: 'pending',
      sent: '2026-11-04',
      ended: '2026-11-11',
      notDelivered: true,
    },
    {
      email: 'ines.duarte@gmail.com',
      role: 'Member',
      by: FOLAKE,
      status: 'expired',
      sent: '2026-10-14',
      ended: '2026-10-21',
      notDelivered: true,
    },
    {
      email: 'lena.vogel@web.de',
      role: 'Admin',
      by: FOLAKE,
      status: 'revoked',
      sent: '2026-10-28',
      ended: '2026-11-03',
      notDelivered: true,
    },
    {
      email: 'yusuf.bello@outlook.com',
      role: 'Member',
      by: JULIEN,
      status: 'declined',
      sent: '2026-10-01',
      ended: '2026-10-03',
      notDelivered: true,
    },
  ];
}

/** The sample's addresses that sc-4332 still holds back, so inviting one again is not delivered either. */
export const SUPPRESSED: ReadonlySet<string> = new Set([
  'ada.obi@ire.events',
  'ines.duarte@gmail.com',
  'lena.vogel@web.de',
]);

export type Filter = 'all' | 'active' | 'invited' | 'waiting' | 'suspended' | 'former';

const FILTER_WORDS: Record<Filter, string> = {
  all: 'All',
  active: 'Active',
  invited: 'Invited',
  waiting: 'Awaiting approval',
  suspended: 'Suspended',
  former: 'Former',
};

/** Awaiting approval only for those who manage members, who are the only ones to see requests. */
export function filtersFor(viewer: Pick<Viewer, 'manages'>): Filter[] {
  return (Object.keys(FILTER_WORDS) as Filter[]).filter(
    (filter) => viewer.manages || filter !== 'waiting',
  );
}

export function filterWord(filter: Filter): string {
  return FILTER_WORDS[filter];
}

export function suspended(status: Status): boolean {
  return status === 'suspended' || status === 'domainSuspended';
}

export function isShown(status: Status, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return status === 'active' || suspended(status);
    case 'active':
      return status === 'active';
    case 'invited':
      return false;
    case 'waiting':
      return status === 'pendingApproval';
    case 'suspended':
      return suspended(status);
    case 'former':
      return status === 'former';
  }
}

export function counts(
  people: readonly Person[],
  invitations: readonly Invitation[],
): Record<Filter, number> {
  const count = (filter: Filter) => people.filter((one) => isShown(one.status, filter)).length;

  return {
    all: count('all'),
    active: count('active'),
    invited: invitations.filter((one) => one.status === 'pending').length,
    waiting: count('waiting'),
    suspended: count('suspended'),
    former: count('former'),
  };
}

export const EMPTY: Record<Exclude<Filter, 'all'>, { title: string; line: string | null }> = {
  active: { title: 'Nobody is active', line: 'Invite somebody to start.' },
  invited: { title: 'No invitations have been sent.', line: null },
  waiting: {
    title: 'Nobody is waiting',
    line: 'Requests to join show here until somebody answers them.',
  },
  suspended: {
    title: 'Nobody is suspended',
    line: `Everyone in ${ORGANISATION} can use it right now.`,
  },
  former: {
    title: 'Nobody has left',
    line: 'People who leave or are removed are listed here, with what they did kept.',
  },
};

export function tagOf(person: Pick<Person, 'status' | 'gone'>): { kind: MarkKind; word: string } {
  switch (person.status) {
    case 'active':
      return { kind: 'yes', word: 'Active' };
    case 'pendingApproval':
      return { kind: 'waiting', word: 'Awaiting approval' };
    case 'suspended':
      return { kind: 'paused', word: 'Suspended' };
    case 'domainSuspended':
      return { kind: 'paused', word: 'Suspended: company domain' };
    case 'former':
      return { kind: 'ended', word: person.gone === 'removed' ? 'Removed' : 'Left' };
  }
}

export function nameOf(people: readonly Person[], id: string): string {
  return people.find((one) => one.id === id)?.name ?? '';
}

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

export function rowLine(person: Person, viewer: Pick<Viewer, 'id'>): string {
  return [person.role ?? 'No role yet', ...(person.id === viewer.id ? ['you'] : [])].join(' · ');
}

export function headcount(count: number): string {
  return count === 1 ? '1 person' : `${count} people`;
}

export const DEADLINES = {
  lucia: '2026-11-16T09:12',
  marta: '2026-11-11T10:00',
  claim: '2026-11-11T09:41',
  passes: '2026-11-06T09:41',
  lapsed: '2026-11-03T09:41',
} as const;

export function waitingLine(person: Person, say: SettingsSay): string {
  return `${person.id} · asked ${say.day(person.history[0]?.when ?? TODAY)}`;
}

export function removesLine(say: SettingsSay): string {
  return `Removed on ${say.deadline(DEADLINES.lucia)} if nobody answers.`;
}

export function historyRows(
  person: Person,
  people: readonly Person[],
  viewer: Pick<Viewer, 'id'>,
  say: SettingsSay,
): { what: string; when: string }[] {
  return person.history.map((step) => ({
    what:
      step.by == null
        ? step.what
        : `${step.what} ${step.by === viewer.id ? 'you' : nameOf(people, step.by)}`,
    when: say.date(step.when),
  }));
}

const ENDED_WORDS = {
  pending: 'expires',
  expired: 'expired',
  revoked: 'revoked',
  declined: 'declined',
} as const;

export const NOT_DELIVERED = 'Not delivered';

export function invitationRow(
  invitation: Invitation,
  people: readonly Person[],
  viewer: Pick<Viewer, 'id'>,
  say: SettingsSay,
): { tag: string | null; line: string; dates: string; notDelivered: boolean } {
  const by = invitation.by === viewer.id ? 'you' : nameOf(people, invitation.by);
  const status = invitation.status;
  const notDelivered = invitation.notDelivered === true;
  const sent = notDelivered ? NOT_DELIVERED : `Sent ${say.date(invitation.sent)}`;

  return {
    tag: status === 'pending' ? null : `${status.charAt(0).toUpperCase()}${status.slice(1)}`,
    line: `${invitation.role} · invited by ${by}`,
    dates: `${sent} · ${ENDED_WORDS[status]} ${say.date(invitation.ended)}`,
    notDelivered,
  };
}

/** The three roles sc-29859 leaves an organisation, the most first. */
export const ROLE_NAMES = ['Owner', 'Admin', 'Member'] as const;

const ROLE_MEANS: Record<string, string> = {
  Owner: 'Everything, including billing and deleting the organisation.',
  Admin: 'Everything except billing. Sees every event and manages members.',
  Member: 'Works on the events they’re added to, and sees no others.',
};

export const WHERE_EVENTS = 'A member’s events come from each event’s People.';

export function roleMeans(role: string): string | null {
  return role === 'Owner'
    ? `${ROLE_MEANS.Owner} Asks you to confirm it’s you.`
    : (ROLE_MEANS[role] ?? null);
}

/** An owner may give every role, an admin Admin or Member. */
export function grantable(viewer: Pick<Viewer, 'owns' | 'manages'>): string[] {
  if (!viewer.manages) return [];

  return ROLE_NAMES.filter((role) => viewer.owns || role !== 'Owner');
}

/** Never Owner, and Member first: the least a person can be let in with. */
export function approvalRoles(viewer: Pick<Viewer, 'owns' | 'manages'>): string[] {
  return grantable(viewer)
    .filter((role) => role !== 'Owner')
    .reverse();
}

/** Under the role choice: where a member's events come from, and for an admin who gives Owner. */
export function underRoles(viewer: Pick<Viewer, 'owns'>): string {
  return viewer.owns ? WHERE_EVENTS : `Only an owner makes someone an owner. ${WHERE_EVENTS}`;
}

export function standingOf(
  person: Person,
  people: readonly Person[],
  viewer: Viewer,
): MemberStanding {
  const owners = people.filter((one) => one.role === 'Owner').length;
  const shaped = (one: Person) => ({
    self: one.id === viewer.id,
    status:
      one.status === 'pendingApproval'
        ? ('pending_approval' as const)
        : one.status === 'former'
          ? ('left_or_removed' as const)
          : suspended(one.status)
            ? ('suspended' as const)
            : ('active' as const),
    role: { id: one.role ?? '', seededAs: one.role === 'Owner' ? 'owner' : one.role },
    suspension: suspended(one.status) ? { onlyOwner: one.role === 'Owner' && owners === 1 } : null,
  });
  const withheld = ROLE_NAMES.filter((role) => !grantable(viewer).includes(role));

  return memberStanding(shaped(person), people.map(shaped), {
    owns: viewer.owns,
    manages: viewer.manages,
    withholds: withheld.map((id) => ({ id })),
  });
}

export function ownerActive(people: readonly Person[]): boolean {
  return people.some((one) => one.role === 'Owner' && one.status === 'active');
}

export type Notice =
  | { kind: 'sent'; email: string }
  | { kind: 'approved'; id: string; role: string }
  | { kind: 'turnedDown'; id: string }
  | { kind: 'removed'; id: string; handed?: Handed }
  | { kind: 'recovered'; id: string; answer: RecoveryAnswer };

/** The product's words for a request to get back in (sc-509), read from the web's catalogue so the two cannot drift. */
export const RECOVERY_WORDS = en.recoveryRequests;
const RR = RECOVERY_WORDS;

/** i18next's slots, filled in English: `{{name}}` and `{{count, number}}`. */
export function filled(words: string, slots: Readonly<Record<string, string | number>>): string {
  return words.replaceAll(/\{\{(\w+)(?:, number)?\}\}/gu, (whole, slot: string) =>
    String(slots[slot] ?? whole),
  );
}

export type RecoveryAnswer = 'approve' | 'turnDown';

export type RecoveryPhase = 'asking' | 'sending' | 'held' | 'failed' | 'closed';

export interface Recovery {
  id: string;
  asked: string;
  provedPhone: boolean;
  /** Answered by somebody else, or ended, since the page loaded. */
  ended: boolean;
}

/** A request lapses 7 × 24 hours after it was proved (sc-509). */
export const RECOVERY_HOURS = 7 * 24;

export function recoveryEnds(asked: string): string {
  return new Date(Date.parse(`${asked}Z`) + RECOVERY_HOURS * 3_600_000).toISOString().slice(0, 16);
}

/** Kofi's and Priya's, oldest first, as wall clock in Lagos like the sample's other deadlines. */
export function sampleRecoveries(): Recovery[] {
  return [
    { id: KOFI, asked: '2026-11-03T18:05', provedPhone: true, ended: false },
    { id: PRIYA, asked: '2026-11-04T08:40', provedPhone: false, ended: false },
  ];
}

const OWN_RECOVERY: Recovery = {
  id: JULIEN,
  asked: '2026-11-04T07:52',
  provedPhone: true,
  ended: false,
};

export function answerable(
  recoveries: readonly Recovery[],
  viewer: Pick<Viewer, 'id' | 'manages'>,
): Recovery[] {
  return viewer.manages ? recoveries.filter((one) => one.id !== viewer.id) : [];
}

export function recoveryRow(
  recovery: Recovery,
  people: readonly Person[],
  viewer: Pick<Viewer, 'id'>,
  say: SettingsSay,
): { name: string; lines: string[]; own: string | null } {
  const own = recovery.id === viewer.id;
  const name = nameOf(people, recovery.id);
  const proved = recovery.provedPhone
    ? own
      ? RR.provedBothOwn
      : RR.provedBoth
    : own
      ? RR.provedEmailOwn
      : RR.provedEmail;

  return {
    name: own ? filled(RR.you, { name }) : name,
    lines: [
      recovery.id,
      `${RR.title} · ${proved}`,
      filled(RR.when, {
        asked: say.deadline(recovery.asked),
        expires: say.deadline(recoveryEnds(recovery.asked)),
      }),
    ],
    own: own ? filled(RR.own, { organisations: ORGANISATION }) : null,
  };
}

export type Claim = 'unclaimed' | 'open' | 'found' | 'withdrawn' | 'lapsed' | 'stopped';

export type CardStep =
  | { label: string; does: 'answer' | 'see' | 'recover'; id: string }
  | { label: string; does: 'former' | 'become' | 'check' };

export interface MembersCard {
  says: string;
  lines: string[];
  step: CardStep | null;
  faces: Person[];
  more: number;
}

export const INVITATIONS_NOTE = 'Nobody has an account here until they accept.';
const FORMER_KEPT = 'They are listed under Former, with everything they did kept.';
export const toGetBackIn = (count: number) => `${count} to get back in`;
export const toJoin = (count: number) => `${count} to join`;
export const RECOVERY_CLOSE = 'Close';
export const RECOVERY_SENDING = 'Sending your answer…';
export const KEEPS_WORKING =
  'Events, guests and your permissions keep working. Only Owner actions, such as billing, wait for an owner.';

/** The oldest request to get back in first, ahead of a request to join: the asker is locked out until somebody answers. */
function firstStep(
  people: readonly Person[],
  recoveries: readonly Recovery[],
  viewer: Pick<Viewer, 'id' | 'manages'>,
): CardStep | null {
  const recovery = answerable(recoveries, viewer)[0];
  const asking = viewer.manages ? people.find((one) => one.status === 'pendingApproval') : null;

  if (recovery != null)
    return { label: `Answer ${nameOf(people, recovery.id)}`, does: 'recover', id: recovery.id };

  return asking == null ? null : { label: `Answer ${asking.name}`, does: 'answer', id: asking.id };
}

export function membersCard({
  people,
  recoveries,
  viewer,
  notice,
  claim,
  say,
}: {
  people: readonly Person[];
  recoveries: readonly Recovery[];
  viewer: Pick<Viewer, 'id' | 'manages'>;
  notice: Notice | null;
  claim: Claim | null;
  say: SettingsSay;
}): MembersCard {
  const quiet = { lines: [], step: null, faces: [], more: 0 };
  const seeFormer = { label: 'See Former', does: 'former' } as const;
  const become = { label: 'Become the owner', does: 'become' } as const;
  const unowned = `${ORGANISATION} has no active owner`;

  switch (notice?.kind) {
    case 'sent':
      return { ...quiet, says: `Invitation sent to ${notice.email}`, lines: [INVITATIONS_NOTE] };
    case 'approved': {
      const name = nameOf(people, notice.id);

      return {
        ...quiet,
        says: `${name} joined as ${notice.role}`,
        step: { label: `See ${name}`, does: 'see', id: notice.id },
      };
    }
    case 'turnedDown':
      return {
        ...quiet,
        says: `You turned down ${nameOf(people, notice.id)}`,
        lines: ['They are listed under Former.'],
        step: seeFormer,
      };
    case 'removed': {
      const handed = notice.handed;
      const stays = `Their events stay with ${ORGANISATION}.`;

      return {
        ...quiet,
        says: `${nameOf(people, notice.id)} was removed`,
        lines: [
          `${handed == null ? stays : ledByLine(handed, nameOf(people, handed.to), viewer.id)} ${FORMER_KEPT}`,
        ],
        // Anyone still waiting comes before See Former, after any removal (pm, 7 Nov).
        step: firstStep(people, recoveries, viewer) ?? seeFormer,
      };
    }
    case 'recovered': {
      const approve = notice.answer === 'approve';

      return {
        ...quiet,
        says: filled(approve ? RR.approved : RR.turnedDown, { name: nameOf(people, notice.id) }),
        lines: [approve ? RR.approvedNext : RR.turnedDownNext],
        step: firstStep(people, recoveries, viewer),
      };
    }
    case undefined:
      break;
  }

  switch (ownerActive(people) ? null : claim) {
    case 'unclaimed':
      return { ...quiet, says: unowned, lines: [KEEPS_WORKING], step: become };
    case 'open':
      return {
        ...quiet,
        says: 'Your claim is open',
        lines: [`We check every hour until ${say.deadline(DEADLINES.claim)}.`],
        step: { label: 'Check record', does: 'check' },
      };
    case 'found':
      return {
        ...quiet,
        says: 'Record found',
        lines: [
          `Ownership passes on ${say.deadline(DEADLINES.passes)}.`,
          'Keep this record published until then. We look it up again at that instant, and ownership passes only if it is still there.',
        ],
      };
    case 'withdrawn':
      return {
        ...quiet,
        says: 'You withdrew your claim',
        lines: ['Everybody who was told is emailed.'],
        step: become,
      };
    case 'lapsed':
      return {
        ...quiet,
        says: unowned,
        lines: [
          `Your claim lapsed on ${say.deadline(DEADLINES.lapsed)}. We did not find the record within the 7 days.`,
          KEEPS_WORKING,
        ],
        step: become,
      };
    case 'stopped':
      return {
        ...quiet,
        says: 'Ownership has to be restored by Soirely support.',
        lines: [KEEPS_WORKING],
      };
    case null:
      break;
  }

  const all = people.filter((one) => isShown(one.status, 'all'));
  const asking = viewer.manages ? people.filter((one) => one.status === 'pendingApproval') : [];
  const back = answerable(recoveries, viewer).length;
  const waiting = back + asking.length;
  const kinds = [toGetBackIn(back), toJoin(asking.length)];
  const faces = all.slice(0, 5);

  return {
    says: [headcount(all.length), ...(waiting > 0 ? [`${waiting} waiting`] : [])].join(' · '),
    lines: back > 0 && asking.length > 0 ? [kinds.join(' · ')] : [],
    step: firstStep(people, recoveries, viewer),
    faces,
    more: all.length - faces.length,
  };
}

export type PersonEvent = 'justSuspended' | 'restored' | 'roleChanged' | 'handedOver';

export interface PersonView {
  lines: string[];
  step: { label: string; does: 'role' | 'restore' } | null;
  kept: boolean;
  after: string[];
  goGeneral: boolean;
  suspend: boolean;
  remove: string | null;
  handOver: boolean;
}

/** sc-40153's names: 89 characters with Yoruba marks, and one word of 100 that has nowhere to break. */
export const LONG_NAME =
  'Ẹgbẹ́ Ọ̀rẹ́ Àṣà Ìbílẹ̀ Ọ̀ṣun Òṣogbo àti Ilé-Ifẹ̀, Ọ̀yọ́, Abẹ́òkúta, Ìjẹ̀bú-Òde àti Ẹ̀kìtì';
export const ONE_WORD_NAME =
  'TheGrandBallroomWeddingsGalasAndGardenPartiesCompanyOfLagosLisbonMadridMonterreyAndPortoAlegreEvents';

export function organisationOf(state: string): string {
  if (state.startsWith('longName')) return LONG_NAME;
  if (state.startsWith('oneWordName')) return ONE_WORD_NAME;
  return ORGANISATION;
}

/** The desk shell does not reflow at 320 until sc-32279, so these states hold the page's column to a 320 page's. */
export function at320(state: string): boolean {
  return state.endsWith('At320');
}

export const LOSES = `They lose access on their next request. Their events stay with ${ORGANISATION}.`;
const OWNER_ONLY = 'Only an owner can change an owner’s role or remove them.';

/** Remove's title, way back and verb: one source for today's confirm and the handover's. */
export function removeWords(
  name: string,
  organisation: string = ORGANISATION,
): Pick<AskWords, 'title' | 'keep' | 'go'> {
  return {
    title: `Remove ${name} from ${organisation}?`,
    keep: `Keep ${firstName(name)}`,
    go: 'Remove',
  };
}

/** Remove's and Hand over now's confirm, with the events the person leads in it. */
export function handoverAsk(
  kind: 'remove' | 'hand',
  name: string,
  count: number,
  organisation: string = ORGANISATION,
): AskWords {
  const lead = H.leads(name, count);

  return kind === 'remove'
    ? {
        ...removeWords(name, organisation),
        lead,
        last: H.removeTail,
        red: true,
        busy: H.busy.remove,
        failed: H.failed.remove,
        checking: H.checking(name),
        notLoaded: H.notLoaded(name),
      }
    : {
        title: H.handTitle(name, count),
        lead,
        last: H.handTail(name, count),
        keep: H.cancel,
        go: H.handOver,
        red: false,
        busy: H.busy.hand,
        failed: H.failed.hand,
        checking: H.checking(name),
        notLoaded: H.notLoaded(name),
      };
}
export const TAKES_EFFECT = 'Takes effect on their next request. Nobody is signed out.';
export const ROLE_KEPT =
  'Their role is kept while they’re suspended. You can change it once their access is restored.';

function eventLines(person: Person, event: PersonEvent | null, say: SettingsSay): string[] {
  const role = person.role ?? '';

  if (person.status === 'domainSuspended')
    return [
      `${person.name}’s ${DOMAIN} address is no longer on their account.`,
      `If nobody answers by ${say.deadline(DEADLINES.marta)}, they are removed.`,
    ];
  if (person.status === 'suspended')
    return event === 'justSuspended'
      ? [
          `They can’t use ${ORGANISATION} from their next request, and they’re emailed in their language. They’re listed under Suspended in Members.`,
        ]
      : [
          `They can’t use ${ORGANISATION}. Their role, their events and their history are kept.`,
          `Restore access returns them as ${role}, the role they held. They’re emailed in their language.`,
        ];
  if (event === 'restored')
    return [
      `${person.name} has access again, as ${role}.`,
      `They can use ${ORGANISATION} from their next request, and they’re emailed in their language.`,
    ];
  if (event === 'roleChanged') return [`${person.name} is now ${role}.`, TAKES_EFFECT];

  return [];
}

/** A person's page by their standing (sc-68): the card's lines and step, the lines after it, and the red actions. */
export function personView({
  person,
  people,
  viewer,
  event,
  handed = null,
  say,
}: {
  person: Person;
  people: readonly Person[];
  viewer: Viewer;
  event: PersonEvent | null;
  handed?: Handed | null;
  say: SettingsSay;
}): PersonView {
  const view: PersonView = {
    lines:
      event === 'handedOver' && handed != null
        ? [
            ledByLine(handed, nameOf(people, handed.to), viewer.id),
            H.handTail(person.name, handed.count),
          ]
        : eventLines(person, event, say),
    step: null,
    kept: false,
    after: [],
    goGeneral: false,
    suspend: false,
    remove: null,
    handOver: false,
  };

  switch (standingOf(person, people, viewer)) {
    case 'self':
      return {
        ...view,
        after: ['You cannot change your own role. An owner or another admin can.'],
      };
    case 'selfOwner':
      return {
        ...view,
        after: [
          'You cannot change your own role. Another owner can, or you can hand ownership to somebody in General.',
        ],
        goGeneral: true,
      };
    case 'onlyOwner':
      return {
        ...view,
        after: [
          `${person.name} is the only owner. An organisation always has one, so their role cannot change and they cannot be removed until somebody else is an owner too.`,
          ...(viewer.owns
            ? []
            : [`Only an owner can make somebody else an owner. Ask ${person.name}.`]),
          ...(viewer.manages
            ? [`Owners cannot be suspended. To suspend ${person.name}, change their role first.`]
            : []),
        ],
      };
    case 'ownerOnly':
      return suspended(person.status)
        ? { ...view, lines: [...view.lines, OWNER_ONLY] }
        : { ...view, after: [OWNER_ONLY] };
    case 'beyondGrant':
    case 'readOnly':
      return view;
    case 'manageable':
    case 'suspendedOnlyOwner':
      break;
  }

  if (suspended(person.status))
    return {
      ...view,
      handOver: true,
      step: {
        label: person.status === 'domainSuspended' ? 'Restore' : 'Restore access',
        does: 'restore',
      },
      kept: true,
      remove:
        person.status === 'domainSuspended'
          ? LOSES
          : `Removing ${person.name} ends their membership of ${ORGANISATION}. Their events stay with ${ORGANISATION}.`,
    };

  return {
    ...view,
    step: { label: 'Change role', does: 'role' },
    suspend: person.role !== 'Owner',
    remove: LOSES,
  };
}

export const SUSPEND_LINE = `They can’t use ${ORGANISATION} from their next request until someone restores their access. Their role, their events and their history are kept.`;

export function suspendAsk(
  name: string,
  organisation: string = ORGANISATION,
): { title: string; line: string } {
  return {
    title: `Suspend ${name}?`,
    line: `${name} can’t use ${organisation} from their next request until someone restores their access. Their role, their events and their history are kept. They’re emailed in their language. The email doesn’t say who suspended them.`,
  };
}

function changed(people: readonly Person[], id: string, change: (one: Person) => Person): Person[] {
  return people.map((one) => (one.id === id ? change(one) : one));
}

export function suspendedBy(people: readonly Person[], id: string, by: string): Person[] {
  return changed(people, id, (one) => ({
    ...one,
    status: 'suspended',
    history: [...one.history, { what: 'Suspended by', by, when: TODAY }],
  }));
}

export function restoredBy(people: readonly Person[], id: string, by: string): Person[] {
  return changed(people, id, (one) => ({
    ...one,
    status: 'active',
    history: [...one.history, { what: 'Restored by', by, when: TODAY }],
  }));
}

export function approved(
  people: readonly Person[],
  id: string,
  role: string,
  by: string,
): Person[] {
  return changed(people, id, (one) => ({
    ...one,
    status: 'active',
    role,
    history: [...one.history, { what: 'Approved by', by, when: TODAY }],
  }));
}

export function removed(people: readonly Person[], id: string): Person[] {
  return changed(people, id, (one) => ({ ...one, status: 'former', gone: 'removed' }));
}

export function withRole(people: readonly Person[], id: string, role: string): Person[] {
  return changed(people, id, (one) => ({ ...one, role }));
}

export function inviteProblem(typed: string): string | null {
  switch (emailProblem(typed)) {
    case 'blank':
      return 'Enter their email address.';
    case 'shape':
      return 'That does not look like an email address. Check it has an @ and a domain, like amara.o@gmail.com.';
    case null:
      return null;
  }
}

export function inviteNote(role: string): string {
  return `They get an email in their language with a link to join ${ORGANISATION} as ${role}. The email says when the link stops working.`;
}

export function invited(
  invitations: readonly Invitation[],
  email: string,
  role: string,
  by: string,
): Invitation[] {
  const address = email.trim();
  const fresh: Invitation = {
    email: address,
    role,
    by,
    status: 'pending',
    sent: TODAY,
    ended: '2026-11-11',
  };

  return [
    SUPPRESSED.has(address) ? { ...fresh, notDelivered: true } : fresh,
    ...invitations.filter((one) => one.email !== address),
  ];
}

export function revoked(invitations: readonly Invitation[], email: string): Invitation[] {
  return invitations.map((one) =>
    one.email === email ? { ...one, status: 'revoked', ended: TODAY } : one,
  );
}

export const PROOF_MINUTES = 5;
export const PROOF_LINE = `To make somebody an owner of ${ORGANISATION}, confirm it’s you. You won’t be asked again for ${PROOF_MINUTES} minutes.`;

export interface ProofProblem {
  field: 'password' | 'code';
  message: string;
}

/** The demo's password and codes, from rules.ts: the authenticator's code or a recovery code. */
export function proofProblem(password: string, code: string): ProofProblem | null {
  const typed = code.replaceAll(/\s/gu, '').toLowerCase();

  if (password === '') return { field: 'password', message: 'Enter your password.' };
  if (typed === '')
    return { field: 'code', message: 'Enter a code from your app, or a recovery code.' };
  if (password !== SAMPLE.password)
    return {
      field: 'password',
      message: 'That is not your password. Try again, or reset it by email.',
    };
  if (typed !== SAMPLE.authenticator && typed !== SAMPLE.recovery)
    return { field: 'code', message: 'That code did not work. Check your app and try again.' };

  return null;
}

export const CLAIM_RECORD = [
  { label: 'Type', value: 'TXT' },
  { label: 'Name', value: `_soirely-verify.${DOMAIN}` },
  { label: 'Value', value: 'soirely-claim=h4k9m2tq7wx3c8rv5bn6jp1fzd0ys4ga' },
] as const;

export type Load = 'loaded' | 'loading' | 'failed';

export interface Proving {
  password: string;
  code: string;
  problem: ProofProblem | null;
}

/** A check runs for a moment; one a link opened in holds still for the link to show it. */
export type Check = 'resting' | 'checking' | 'held' | 'missing';

export type MembersDialog =
  | { kind: 'invite'; email: string; role: string; problem: string | null }
  | { kind: 'request'; id: string; picked: string; ask: 'turnDown' | 'discard' | null }
  | { kind: 'role'; id: string; picked: string; ask: boolean; proving: Proving | null }
  | { kind: 'remove' | 'handOver'; id: string; hand?: HandStart }
  | { kind: 'suspend'; id: string }
  | { kind: 'claim'; check: Check; copied: string | null; ask: boolean }
  | { kind: 'withdraw' }
  | { kind: 'recovery'; id: string; answer: RecoveryAnswer; phase: RecoveryPhase };

export interface MembersStart {
  load: Load;
  people: Person[];
  recoveries: Recovery[];
  invitations: Invitation[];
  filter: Filter;
  menu: boolean;
  open: string | null;
  event: PersonEvent | null;
  notice: Notice | null;
  claim: Claim | null;
  dialog: MembersDialog | null;
  leads: Leads;
  /** The work list a suspended member's page waits on. */
  leadsLoad: Load;
  handed: Handed | null;
}

export const MEMBERS_STATES = [
  'menu',
  'nobodySuspended',
  'nobodyLeft',
  'invited',
  'revoked',
  'loading',
  'failed',
  'invite',
  'inviteBlank',
  'inviteShape',
  'sent',
  'notDelivered',
  'notDeliveredInvited',
  'notDeliveredAgain',
  'request',
  'turningDown',
  'requestDiscard',
  'approved',
  'turnedDown',
  'removed',
  'former',
  'priya',
  'alsoMember',
  'longName',
  'oneWordName',
  'longNameAt320',
  'oneWordNameAt320',
  'role',
  'roleAdmin',
  'roleDiscard',
  'removing',
  'self',
  'folake',
  'makeOwner',
  'makeOwnerBlank',
  'makeOwnerWrong',
  'marta',
  'suspending',
  'justSuspended',
  'suspended',
  'restored',
  'noOwner',
  'claim',
  'claimCopied',
  'claimChecking',
  'claimMissing',
  'claimOpen',
  'withdrawing',
  'withdrawn',
  'found',
  'lapsed',
  'stopped',
  'handover',
  'handoverMenu',
  'handoverPicked',
  'handoverLong',
  'handoverOne',
  'handoverLongNames',
  'handoverLoading',
  'handoverLoadFailed',
  'handoverRefused',
  'handoverSearch',
  'handoverSearchNobody',
  'removingNoWork',
  'handoverSending',
  'handoverFailed',
  'handoverDone',
  'martaOne',
  'martaLoading',
  'martaLoadFailed',
  'handoverNow',
  'handoverNowSending',
  'handoverNowFailed',
  'handoverNowDone',
  'handoverReadOnly',
  'recovery',
  'recoveryApprove',
  'recoveryTurnDown',
  'recoveryApproved',
  'recoveryTurnedDown',
  'recoveryClosed',
  'recoveryClosedLast',
  'recoverySending',
  'recoveryFailed',
  'recoveryDone',
  'recoveryOwn',
] as const;

export type MembersState = (typeof MEMBERS_STATES)[number];

type RecoveryState = Extract<MembersState, `recovery${string}`>;

function isRecovery(state: MembersState): state is RecoveryState {
  return state.startsWith('recovery');
}

/** Each recovery state as its board draws it; null where the viewer cannot reach it. */
function recoveryStart(
  state: RecoveryState,
  viewer: Pick<Viewer, 'id' | 'manages'>,
): Pick<MembersStart, 'recoveries' | 'notice' | 'dialog'> | null {
  const both = sampleRecoveries();
  const priya = both.filter((one) => one.id !== KOFI);
  const asks = (answer: RecoveryAnswer, phase: RecoveryPhase = 'asking') =>
    ({ kind: 'recovery', id: KOFI, answer, phase }) as const;
  const answered = (id: string, answer: RecoveryAnswer) =>
    ({ kind: 'recovered', id, answer }) as const;

  if (!viewer.manages) return null;

  switch (state) {
    case 'recovery':
      return { recoveries: both, notice: null, dialog: null };
    case 'recoveryApprove':
      return { recoveries: both, notice: null, dialog: asks('approve') };
    case 'recoveryTurnDown':
      return { recoveries: both, notice: null, dialog: asks('turnDown') };
    case 'recoveryApproved':
      return { recoveries: priya, notice: answered(KOFI, 'approve'), dialog: null };
    case 'recoveryTurnedDown':
      return { recoveries: priya, notice: answered(KOFI, 'turnDown'), dialog: null };
    case 'recoveryClosed':
      return {
        recoveries: both.map((one) => (one.id === KOFI ? { ...one, ended: true } : one)),
        notice: null,
        dialog: asks('approve', 'closed'),
      };
    case 'recoveryClosedLast':
      return {
        recoveries: both.filter((one) => one.id === KOFI).map((one) => ({ ...one, ended: true })),
        notice: answered(PRIYA, 'approve'),
        dialog: asks('approve', 'closed'),
      };
    case 'recoverySending':
      return { recoveries: both, notice: null, dialog: asks('approve', 'held') };
    case 'recoveryFailed':
      return { recoveries: both, notice: null, dialog: asks('approve', 'failed') };
    case 'recoveryDone':
      return { recoveries: [], notice: answered(PRIYA, 'approve'), dialog: null };
    case 'recoveryOwn':
      return viewer.id === JULIEN
        ? { recoveries: [OWN_RECOVERY], notice: null, dialog: null }
        : null;
  }
}

const CLAIMS: Partial<Record<MembersState, Claim>> = {
  noOwner: 'unclaimed',
  claim: 'open',
  claimCopied: 'open',
  claimChecking: 'open',
  claimMissing: 'open',
  claimOpen: 'open',
  withdrawing: 'open',
  withdrawn: 'withdrawn',
  found: 'found',
  lapsed: 'lapsed',
  stopped: 'stopped',
};

function dialogOf(state: MembersState, viewer: Pick<Viewer, 'id'>): MembersDialog | null {
  const request = { kind: 'request', id: LUCIA, picked: 'Member', ask: null } as const;
  const role = {
    kind: 'role',
    id: PRIYA,
    picked: 'Member',
    ask: false,
    proving: null,
  } as const;
  const proving = { password: '', code: '', problem: null };
  const claim = { kind: 'claim', check: 'resting', copied: null, ask: false } as const;
  const remove = (hand?: Partial<HandStart>) =>
    ({ kind: 'remove', id: PRIYA, hand: handStart(viewer.id, hand) }) as const;
  const handOver = (hand?: Partial<HandStart>) =>
    ({ kind: 'handOver', id: MARTA, hand: handStart(viewer.id, hand) }) as const;

  switch (state) {
    case 'invite':
      return { kind: 'invite', email: '', role: 'Member', problem: null };
    case 'inviteBlank':
      return { kind: 'invite', email: '', role: 'Member', problem: inviteProblem('') };
    case 'inviteShape':
      return {
        kind: 'invite',
        email: 'chidi.okafor',
        role: 'Member',
        problem: inviteProblem('chidi.okafor'),
      };
    case 'request':
      return request;
    case 'turningDown':
      return { ...request, ask: 'turnDown' };
    case 'requestDiscard':
      return { ...request, picked: 'Admin', ask: 'discard' };
    case 'role':
      return role;
    case 'roleAdmin':
      return { ...role, picked: 'Admin' };
    case 'roleDiscard':
      return { ...role, picked: 'Admin', ask: true };
    case 'removing':
    case 'handover':
      return remove();
    case 'handoverMenu':
      return remove({ menu: true });
    case 'handoverPicked':
      return { ...remove(), hand: handStart(ANA) };
    case 'handoverLong':
      return { ...remove(), id: JULIEN };
    case 'handoverSearch':
      return remove({ menu: true, query: 'jo' });
    case 'handoverSearchNobody':
      return remove({ menu: true, query: 'kemi' });
    case 'removingNoWork':
      return { ...remove(), id: TOM };
    case 'handoverSending':
      return remove({ phase: 'held' });
    case 'handoverFailed':
      return remove({ phase: 'failed' });
    case 'handoverOne':
    case 'handoverLongNames':
      return remove();
    case 'handoverLoading':
      return remove({ phase: 'checking' });
    case 'handoverLoadFailed':
      return remove({ phase: 'notLoaded' });
    case 'handoverRefused':
      return { ...remove({ phase: 'refused' }), id: TOM };
    case 'handoverNow':
      return handOver();
    case 'handoverNowSending':
      return handOver({ phase: 'held' });
    case 'handoverNowFailed':
      return handOver({ phase: 'failed' });
    case 'suspending':
      return { kind: 'suspend', id: PRIYA };
    case 'makeOwner':
      return { ...role, id: ANA, picked: 'Owner', proving };
    case 'makeOwnerBlank':
      return {
        ...role,
        id: ANA,
        picked: 'Owner',
        proving: { ...proving, problem: proofProblem('', '') },
      };
    case 'makeOwnerWrong':
      return {
        ...role,
        id: ANA,
        picked: 'Owner',
        proving: {
          password: SAMPLE.password,
          code: '481 207',
          problem: proofProblem(SAMPLE.password, '481207'),
        },
      };
    case 'claim':
      return claim;
    case 'claimCopied':
      return { ...claim, copied: 'Value' };
    case 'claimChecking':
      return { ...claim, check: 'held' };
    case 'claimMissing':
      return { ...claim, check: 'missing' };
    case 'withdrawing':
      return { ...claim, ask: true };
    default:
      return null;
  }
}

function openOf(state: MembersState, viewer: Pick<Viewer, 'id'>): string | null {
  switch (state) {
    case 'priya':
    case 'alsoMember':
    case 'longName':
    case 'oneWordName':
    case 'longNameAt320':
    case 'oneWordNameAt320':
    case 'role':
    case 'roleAdmin':
    case 'roleDiscard':
    case 'removing':
    case 'suspending':
    case 'justSuspended':
    case 'suspended':
    case 'restored':
    case 'handover':
    case 'handoverMenu':
    case 'handoverPicked':
    case 'handoverSearch':
    case 'handoverSearchNobody':
    case 'handoverSending':
    case 'handoverFailed':
    case 'handoverOne':
    case 'handoverLongNames':
    case 'handoverLoading':
    case 'handoverLoadFailed':
      return PRIYA;
    case 'handoverLong':
      return JULIEN;
    case 'removingNoWork':
    case 'handoverRefused':
      return TOM;
    case 'makeOwner':
    case 'makeOwnerBlank':
    case 'makeOwnerWrong':
      return ANA;
    case 'marta':
    case 'martaOne':
    case 'martaLoading':
    case 'martaLoadFailed':
    case 'handoverNow':
    case 'handoverNowSending':
    case 'handoverNowFailed':
    case 'handoverNowDone':
    case 'handoverReadOnly':
      return MARTA;
    case 'self':
      return viewer.id;
    case 'folake':
      return FOLAKE;
    default:
      return null;
  }
}

function peopleOf(state: MembersState, viewer: Pick<Viewer, 'id'>): Person[] {
  const people = samplePeople();
  const byHand = (from: Person[]) => suspendedBy(from, PRIYA, viewer.id);

  switch (state) {
    case 'nobodySuspended':
      return changed(people, MARTA, (one) => ({
        ...one,
        status: 'active',
        history: one.history.slice(0, 1),
      }));
    case 'nobodyLeft':
      return people.filter((one) => one.id !== DANIEL);
    case 'approved':
      return approved(people, LUCIA, 'Member', viewer.id);
    case 'turnedDown':
      return removed(people, LUCIA);
    case 'removed':
    case 'former':
    case 'handoverDone':
      return removed(people, PRIYA);
    case 'handoverSearch':
    case 'handoverSearchNobody':
      return [...people, ...morePeople()];
    case 'handoverReadOnly':
      return withRole(people, MARTA, 'Owner');
    case 'justSuspended':
    case 'suspended':
      return byHand(people);
    case 'restored':
      return restoredBy(byHand(people), PRIYA, viewer.id);
    default:
      return CLAIMS[state] == null
        ? people
        : changed(people, FOLAKE, (one) => ({ ...one, status: 'suspended' }));
  }
}

function handedOf(state: MembersState, viewer: Pick<Viewer, 'id'>): Handed | null {
  switch (state) {
    case 'removed':
    case 'handoverDone':
      return { to: ANA, count: 3 };
    case 'handoverNowDone':
      return { to: viewer.id, count: 2 };
    default:
      return null;
  }
}

function leadsOf(state: MembersState, viewer: Pick<Viewer, 'id'>): Leads {
  const leads = sampleLeads();

  switch (state) {
    case 'handoverLong':
      return { ...leads, [JULIEN]: Object.values(EVENT) };
    case 'handoverOne':
      return { ...leads, [PRIYA]: [EVENT.ireti] };
    case 'handoverLongNames':
      return { ...leads, [PRIYA]: [EVENT.wed, LONG_NAMED, EVENT.off] };
    case 'handoverRefused':
      return { ...leads, [TOM]: [EVENT.gala, EVENT.draft] };
    case 'martaOne':
      return { ...leads, [MARTA]: [EVENT.party] };
    case 'removed':
    case 'handoverDone':
      return handedOver(leads, PRIYA, ANA);
    case 'handoverNowDone':
      return handedOver(leads, MARTA, viewer.id);
    default:
      return leads;
  }
}

function noticeOf(state: MembersState): Notice | null {
  switch (state) {
    case 'sent':
      return { kind: 'sent', email: 'chidi.okafor@ire.events' };
    case 'notDeliveredAgain':
      return { kind: 'sent', email: 'ines.duarte@gmail.com' };
    case 'approved':
      return { kind: 'approved', id: LUCIA, role: 'Member' };
    case 'turnedDown':
      return { kind: 'turnedDown', id: LUCIA };
    case 'removed':
    case 'handoverDone':
      return { kind: 'removed', id: PRIYA, handed: { to: ANA, count: 3 } };
    default:
      return null;
  }
}

const FILTERS: Partial<Record<MembersState, Filter>> = {
  nobodySuspended: 'suspended',
  nobodyLeft: 'former',
  invited: 'invited',
  revoked: 'invited',
  notDeliveredInvited: 'invited',
  former: 'former',
};

function invitationsOf(state: MembersState, viewer: Pick<Viewer, 'id'>): Invitation[] {
  switch (state) {
    case 'revoked':
      return revoked(sampleInvitations(), 'nnamdi.eze@ire.events');
    case 'sent':
      return invited(sampleInvitations(), 'chidi.okafor@ire.events', 'Member', viewer.id);
    case 'notDelivered':
    case 'notDeliveredInvited':
      return undeliveredInvitations();
    case 'notDeliveredAgain':
      return invited(undeliveredInvitations(), 'ines.duarte@gmail.com', 'Member', viewer.id);
    default:
      return sampleInvitations();
  }
}

const EVENTS: Partial<Record<MembersState, PersonEvent>> = {
  justSuspended: 'justSuspended',
  restored: 'restored',
  handoverNowDone: 'handedOver',
};

/** Where each state the boards draw starts; any other name, or one the viewer cannot reach, is the whole page. */
export function membersStart(name: string, viewer: Pick<Viewer, 'id' | 'manages'>): MembersStart {
  const state = MEMBERS_STATES.find((one) => one === name);
  const invitations = sampleInvitations();
  const start: MembersStart = {
    load: 'loaded',
    people: samplePeople(),
    recoveries: [],
    invitations,
    filter: 'all',
    menu: false,
    open: null,
    event: null,
    notice: null,
    claim: null,
    dialog: null,
    leads: sampleLeads(),
    leadsLoad: 'loaded',
    handed: null,
  };

  if (state == null) return start;
  if (isRecovery(state)) return { ...start, ...recoveryStart(state, viewer) };

  const dialog = dialogOf(state, viewer);

  return {
    ...start,
    load: state === 'loading' || state === 'failed' ? state : 'loaded',
    leadsLoad:
      state === 'martaLoading' ? 'loading' : state === 'martaLoadFailed' ? 'failed' : 'loaded',
    people: peopleOf(state, viewer),
    invitations: invitationsOf(state, viewer),
    filter: FILTERS[state] ?? 'all',
    menu: state === 'menu',
    open: openOf(state, viewer),
    event: EVENTS[state] ?? null,
    notice: noticeOf(state),
    claim: CLAIMS[state] ?? null,
    dialog: dialog != null && 'id' in dialog && dialog.id === viewer.id ? null : dialog,
    leads: leadsOf(state, viewer),
    handed: handedOf(state, viewer),
  };
}

/** How many other organisations a person is in, said under their card with no names (sc-563); the sample has Priya in 2. */
export function alsoMemberLine(count: number): string {
  return count === 1
    ? 'Also a member of 1 other organisation'
    : `Also a member of ${count} other organisations`;
}

export const ALSO_MEMBER: Readonly<Record<string, number>> = { [PRIYA]: 2 };
