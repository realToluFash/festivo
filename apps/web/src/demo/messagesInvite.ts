import { demoWords } from './demoWords.ts';
import { INVITATION_NOTE, LONG_NOTE } from './guest.ts';
import { type Guest, WEDDING, dayOf, inChoice, sampleGuests } from './guests.ts';
import { GW } from './guestsWords.ts';
import {
  type Channel,
  type Ticks,
  type Untellable,
  EVENT_NAME,
  HOSTS,
  INVITE,
} from './messages.ts';
import { IW } from './messagesInviteWords.ts';
import {
  type Audience,
  type Condition,
  type Group,
  type OneGuest,
  type SampleGuest,
  type World,
  whoMatches,
} from './messagesTo.ts';
import { MW } from './messagesWords.ts';
import { type SmsAbout, REPLY_BY, inviteSmsOf, oneGuestOf } from './inviteSms.ts';
import { type Text, textsCredits } from './smsCredits.ts';

/** Send invitations from the composer (sc-3971): who an invitation goes to, who already has one, who it cannot reach, and the note. */
export { IW };
export {
  type InviteSms,
  type SmsAbout,
  LINK_CHARS,
  REPLY_BY,
  greetingOf,
  inviteSmsOf,
  oneGuestOf,
  smsParts,
} from './inviteSms.ts';

/** The wedding's text, read when asked: messages.ts imports this file before its own values are set. */
export function weddingAbout(): SmsAbout {
  return { hosts: HOSTS, event: EVENT_NAME, date: INVITE.date, replyBy: REPLY_BY };
}

const mw = demoWords(MW);
const iw = demoWords(IW);
const COLLATOR = new Intl.Collator('en', { sensitivity: 'base' });

export const NOTE_MOST = 10_000;
export const INVITE_TICKS: Ticks = { email: true, sms: true, whatsApp: false };
export const INVITE_CHANNELS = ['email', 'sms'] as const;
export const NOTE = INVITATION_NOTE.words;
export const TOO_LONG_NOTE = Array<string>(Math.ceil(NOTE_MOST / LONG_NOTE.words.length) + 1)
  .fill(LONG_NOTE.words)
  .join('\n\n');
export const ALREADY_SENT_ON = '2026-10-12';

export const WEDDING_GUESTS: readonly Guest[] = [...sampleGuests(WEDDING)].sort((a, b) =>
  COLLATOR.compare(a.name, b.name),
);

function weddingGuest(id: string): OneGuest {
  const found = WEDDING_GUESTS.find((guest) => guest.id === id);

  if (found == null) throw new Error(`No guest ${id} on the wedding`);

  return oneGuestOf(found);
}

const INVITED_GUESTS: readonly OneGuest[] = WEDDING_GUESTS.filter((guest) =>
  inChoice(guest.reply, 'invited'),
).map(oneGuestOf);

export const FOURTEEN: readonly OneGuest[] = WEDDING_GUESTS.filter(
  (guest) => guest.reply === 'notYet',
).map(oneGuestOf);

const FOURTEEN_SAMPLES: readonly SampleGuest[] = FOURTEEN.map((one) => ({
  name: one.name,
  reply: 'none',
  invited: false,
  group: null,
  email: one.email,
  mobile: one.mobile,
}));

function onlyNotInvited(conditions: readonly Condition[]): boolean {
  return conditions.length === 1 && conditions[0] === 'notInvited';
}

/** To on an invitation: All guests is the Guests demo's 156, and Not yet invited its fourteen; every other row as Messages counts it. */
export const INVITE_WORLD: World = {
  all: INVITED_GUESTS.length + FOURTEEN.length,
  matches: (conditions, groups) =>
    onlyNotInvited(conditions) ? [...FOURTEEN_SAMPLES] : whoMatches(conditions, groups),
};

export const NOT_YET_INVITED: Audience = {
  kind: 'who',
  conditions: ['notInvited'],
  pick: 'notInvited',
};

export function guestAudience(id: string): Audience {
  return { kind: 'guest', guest: weddingGuest(id) };
}

export function noteTooLong(note: string): boolean {
  return [...note.trim()].length > NOTE_MOST;
}

export function noteRefusal(note: string): string | null {
  return noteTooLong(note) ? iw.filled(IW.noteTooLong, { count: NOTE_MOST }) : null;
}

export function previewPeople(audience: Audience, groups: readonly Group[]): readonly OneGuest[] {
  if (audience.kind === 'guest') return [audience.guest];
  if (audience.kind === 'all') return [oneGuestOf(WEDDING_GUESTS[0] as Guest), ...FOURTEEN];
  if (onlyNotInvited(audience.conditions)) return FOURTEEN;

  return whoMatches(audience.conditions, groups).slice(0, 5).map(sampleOne);
}

export function firstOf(audience: Audience, groups: readonly Group[]): OneGuest | null {
  return previewPeople(audience, groups)[0] ?? null;
}

function sampleOne(guest: SampleGuest): OneGuest {
  return {
    id: guest.name,
    name: guest.name,
    greetAs: null,
    email: guest.email,
    mobile: guest.mobile,
    invited: guest.invited ? GW.invitedByMessage(dayOf(ALREADY_SENT_ON)) : null,
  };
}

function weddingText(guest: OneGuest): Text {
  const country = WEDDING_GUESTS.find((one) => one.id === guest.id)?.phone?.country;

  if (country == null) throw new Error(`No number for ${guest.name} on the wedding`);

  return { parts: inviteSmsOf(guest, weddingAbout(), guest.invited == null).parts, country };
}

interface Members {
  fresh: readonly OneGuest[];
  already: number;
  invited: readonly OneGuest[];
  /** Guests already invited whom only Messages' own figures count. */
  counted: boolean;
}

function membersOf(audience: Audience, groups: readonly Group[]): Members {
  if (audience.kind === 'guest') {
    const invited = audience.guest.invited != null;

    return {
      fresh: invited ? [] : [audience.guest],
      already: invited ? 1 : 0,
      invited: invited ? [audience.guest] : [],
      counted: false,
    };
  }
  if (audience.kind === 'all')
    return {
      fresh: FOURTEEN,
      already: INVITED_GUESTS.length,
      invited: INVITED_GUESTS,
      counted: false,
    };
  if (onlyNotInvited(audience.conditions))
    return { fresh: FOURTEEN, already: 0, invited: [], counted: false };

  const matched = whoMatches(audience.conditions, groups);
  const invited = matched.filter((guest) => guest.invited);

  return {
    fresh: matched.filter((guest) => !guest.invited).map(sampleOne),
    already: invited.length,
    invited: invited.map(sampleOne),
    counted: true,
  };
}

export interface Counted {
  counts: Record<Channel, number>;
  cantTell: number;
  names: readonly Untellable[];
}

export interface InviteCheck {
  kind: 'check';
  count: number;
  already: number;
  named: readonly Untellable[];
  alreadyAll: readonly Untellable[];
  choose: boolean;
  pills: readonly { channel: 'email' | 'sms'; count: number }[];
  cant: number;
  cantNames: readonly Untellable[];
  cantAll: readonly Untellable[];
  credits: string | null;
}

export interface InviteRefusal {
  kind: 'refused';
  count: number;
  title: string;
  reason: string;
  cant: number;
  cantNames: readonly Untellable[];
  cantAll: readonly Untellable[];
}

function whyNot(guest: OneGuest, ticks: Ticks): string[] {
  return [
    ...(guest.email ? [] : [MW.noEmail]),
    ...(guest.mobile ? (ticks.sms ? [] : [MW.smsIsOff]) : [MW.noPhone]),
  ];
}

function reaches(guest: OneGuest, ticks: Ticks): boolean {
  return (guest.email && ticks.email) || (guest.mobile && ticks.sms);
}

/** The check before an invitation goes, or why it cannot: the note first, then reach (sc-3971). */
export function inviteCheckOf(
  audience: Audience,
  ticks: Ticks,
  again: boolean,
  counted: Counted,
  balance: number,
  groups: readonly Group[] = [],
): InviteCheck | InviteRefusal {
  const members = membersOf(audience, groups);
  const everyone = again || members.fresh.length === 0;
  const individuals =
    everyone && !members.counted ? [...members.invited, ...members.fresh] : members.fresh;
  const base = everyone && members.counted && members.already > 0 ? counted : null;
  const count = (everyone ? members.already : 0) + members.fresh.length;
  const on = INVITE_CHANNELS.filter((channel) => ticks[channel]);
  const people = (channel: 'email' | 'sms') =>
    individuals.filter((guest) => (channel === 'email' ? guest.email : guest.mobile)).length +
    (base?.counts[channel] ?? 0);
  const cantPeople = individuals.filter((guest) => !reaches(guest, ticks));
  const cantAll = [
    ...(base?.names ?? []),
    ...cantPeople.map((guest) => ({ name: guest.name, why: whyNot(guest, ticks) })),
  ];
  const cantNames = cantAll.slice(0, 2);
  const alreadyAll = members.invited.map((guest) => ({
    name: guest.name,
    why: guest.invited == null ? [] : [guest.invited],
  }));
  const cant = on.length === 0 ? count : cantPeople.length + (base?.cantTell ?? 0);

  if (count > 0 && cant >= count)
    return {
      kind: 'refused',
      count,
      title: iw.many('cannotSend', count),
      reason: iw.many('noneReached', count),
      cant,
      cantNames,
      cantAll,
    };

  const texted = individuals.filter((guest) => guest.mobile);
  const credits = !ticks.sms
    ? 0
    : members.counted
      ? texted.length + (base?.counts.sms ?? 0)
      : textsCredits(texted.map(weddingText));

  return {
    kind: 'check',
    count,
    already: members.already,
    named: alreadyAll.slice(0, 2),
    alreadyAll,
    choose: members.already > 0 && members.fresh.length > 0,
    pills: on.map((channel) => ({ channel, count: people(channel) })),
    cant: on.length === 0 ? 0 : cant,
    cantNames: on.length === 0 ? [] : cantNames,
    cantAll: on.length === 0 ? [] : cantAll,
    credits:
      on.length === 0
        ? null
        : credits === 0
          ? MW.emailNoCredits
          : `${mw.many('textsUse', credits)} ${mw.filled(MW.creditsAfter, { count: balance - credits })}`,
  };
}

export interface InviteDraft {
  note: string;
  again: boolean;
  /** The note was over the limit when Send was pressed, and still is. */
  wrong: boolean;
  /** Send has been pressed once: the note is checked again when it loses focus. */
  pressed: boolean;
  previewAs?: string;
  seeAll?: 'already' | 'cant';
}

export interface InviteOut {
  note: string;
  again: boolean;
  count: number;
  reached: number;
  greeting: string;
}

export const INVITE_GROUP = 'Send invitations (sc-3971)';

export const INVITE_STATES = [
  { key: 'inviteWrite', name: 'The invitation, from Send invitations' },
  { key: 'inviteTo', name: 'To on an invitation: Not yet invited, a quick pick' },
  { key: 'inviteWriteOne', name: 'The invitation, from a guest’s details' },
  { key: 'inviteNote', name: 'The note written' },
  { key: 'inviteNoteLong', name: 'The note too long' },
  { key: 'invitePreview', name: 'The preview for one guest, no note' },
  { key: 'invitePreviewNote', name: 'The preview, with the note on their page' },
  { key: 'invitePreviewSms', name: 'Previewed as Yusuf Ibrahim, by text' },
  { key: 'inviteCheck', name: 'The check, nobody already invited' },
  { key: 'inviteCheckSome', name: 'The check, some already invited' },
  { key: 'inviteCheckAgain', name: 'The check, Send again chosen' },
  { key: 'inviteCheckSeeAll', name: 'See all 87 already invited, open' },
  { key: 'inviteCheckAll', name: 'The check, everyone already invited' },
  { key: 'inviteRefused', name: 'Refused, nobody can be reached' },
  { key: 'inviteCountdown', name: 'Ten seconds, an invitation' },
  { key: 'inviteSent', name: 'Where it lands: its own Invitation conversation' },
] as const;

export type InviteState = (typeof INVITE_STATES)[number]['key'];

export function isInviteState(key: string): key is InviteState {
  return INVITE_STATES.some((one) => one.key === key);
}

export type InviteSeed =
  | {
      kind: 'draft';
      to: Audience;
      step: 'write' | 'preview' | 'check';
      openTo: boolean;
      invite: InviteDraft;
    }
  | {
      kind: 'out';
      to: Audience;
      stage: 'countdown' | 'sent';
      left: number;
      invite: Pick<InviteOut, 'note'>;
    };

const NO_NOTE: InviteDraft = { note: '', again: false, wrong: false, pressed: false };
const WITH_NOTE: InviteDraft = { ...NO_NOTE, note: NOTE };

export function inviteSeedOf(state: string | null): InviteSeed | null {
  const draft = (
    to: Audience,
    step: 'write' | 'preview' | 'check',
    invite: InviteDraft = NO_NOTE,
    openTo = false,
  ): InviteSeed => ({ kind: 'draft', to, step, openTo, invite });

  switch (state) {
    case 'inviteWrite':
      return draft(NOT_YET_INVITED, 'write');
    case 'inviteTo':
      return draft(NOT_YET_INVITED, 'write', NO_NOTE, true);
    case 'inviteWriteOne':
      return draft(guestAudience('bisi'), 'write');
    case 'inviteNote':
      return draft(NOT_YET_INVITED, 'write', WITH_NOTE);
    case 'inviteNoteLong':
      return draft(NOT_YET_INVITED, 'write', {
        ...NO_NOTE,
        note: TOO_LONG_NOTE,
        wrong: true,
        pressed: true,
      });
    case 'invitePreview':
      return draft(NOT_YET_INVITED, 'preview', { ...NO_NOTE, previewAs: 'bisi' });
    case 'invitePreviewNote':
      return draft(NOT_YET_INVITED, 'preview', { ...WITH_NOTE, previewAs: 'bisi' });
    case 'invitePreviewSms':
      return draft(NOT_YET_INVITED, 'preview', { ...WITH_NOTE, previewAs: 'yusuf' });
    case 'inviteCheck':
      return draft(NOT_YET_INVITED, 'check', WITH_NOTE);
    case 'inviteCheckSome':
      return draft({ kind: 'all' }, 'check');
    case 'inviteCheckAgain':
      return draft({ kind: 'all' }, 'check', { ...NO_NOTE, again: true });
    case 'inviteCheckSeeAll':
      return draft({ kind: 'all' }, 'check', { ...NO_NOTE, seeAll: 'already' });
    case 'inviteCheckAll':
      return draft(guestAudience('emeka'), 'check');
    case 'inviteRefused':
      return draft(guestAudience('joaquin'), 'check');
    case 'inviteCountdown':
      return {
        kind: 'out',
        to: NOT_YET_INVITED,
        stage: 'countdown',
        left: 7,
        invite: { note: NOTE },
      };
    case 'inviteSent':
      return { kind: 'out', to: NOT_YET_INVITED, stage: 'sent', left: 0, invite: { note: NOTE } };
    default:
      return null;
  }
}
