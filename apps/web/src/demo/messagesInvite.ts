import { demoWords } from './demoWords.ts';
import { INVITATION_NOTE, LONG_NOTE } from './guest.ts';
import { type Guest, WEDDING, dayOf, inChoice, sampleGuests } from './guests.ts';
import { GW } from './guestsWords.ts';
import {
  type Category,
  type Channel,
  type Ticks,
  type Untellable,
  type WhatsAppInviteOf,
  EVENT_NAME,
  HOSTS,
  INVITE,
  creditsLine,
  reachWords,
  whatsAppCreditsIn,
} from './messages.ts';
import { IW, WA_INVITATION, WA_INVITE_STATES } from './messagesInviteWords.ts';
import { type Waits, waitsOf } from './messagesWaits.ts';
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
import { type SmsAbout, REPLY_BY, greetingOf, inviteSmsOf, oneGuestOf } from './inviteSms.ts';
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
const WA_CHANNELS = ['email', 'sms', 'whatsApp'] as const;

export function inviteChannelsOf(wa: Category | undefined): readonly InviteChannel[] {
  return wa == null ? INVITE_CHANNELS : WA_CHANNELS;
}

export type InviteChannel = (typeof WA_CHANNELS)[number];
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

type Consent = 'agreed' | 'none' | 'stopped';

interface WaSample {
  country: string;
  consent: Consent;
  noEmail?: true;
  language?: string;
}

const WA_SAMPLE: Readonly<Record<string, WaSample>> = {
  'chuka-nwankwo': { country: 'NG', consent: 'agreed' },
  'dami-oladipo': { country: 'NG', consent: 'agreed', language: 'fr' },
  'femi-ogundipe': { country: 'NG', consent: 'agreed' },
  'catarina-reis': { country: 'BR', consent: 'agreed', noEmail: true, language: 'pt' },
  'noor-rahman': { country: 'GB', consent: 'agreed', language: 'es' },
  'kenji-watanabe': { country: 'US', consent: 'agreed' },
  'lina-saleh': { country: 'US', consent: 'agreed' },
  yusuf: { country: 'NG', consent: 'none' },
  'patrice-leroy': { country: 'FR', consent: 'none' },
  'elif-kaya': { country: 'GB', consent: 'stopped' },
};

function waSampleOf(guest: OneGuest, wa: Category | undefined): WaSample | null {
  return wa == null ? null : (WA_SAMPLE[guest.id] ?? null);
}

/** The guest as the WhatsApp states have them: a mobile number, and Catarina reached by it alone. */
function withWhatsApp(guest: OneGuest, wa: Category | undefined): OneGuest {
  const sample = waSampleOf(guest, wa);

  return sample == null
    ? guest
    : { ...guest, mobile: true, email: guest.email && sample.noEmail !== true };
}

function overlaid(guests: readonly OneGuest[], wa: Category | undefined): readonly OneGuest[] {
  return wa == null ? guests : guests.map((guest) => withWhatsApp(guest, wa));
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

export function previewPeople(
  audience: Audience,
  groups: readonly Group[],
  wa?: Category,
): readonly OneGuest[] {
  if (audience.kind === 'guest') return [audience.guest];
  if (audience.kind === 'all')
    return [oneGuestOf(WEDDING_GUESTS[0] as Guest), ...overlaid(FOURTEEN, wa)];
  if (onlyNotInvited(audience.conditions)) return overlaid(FOURTEEN, wa);

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

function weddingText(guest: OneGuest, wa: Category | undefined): Text {
  const country =
    waSampleOf(guest, wa)?.country ??
    WEDDING_GUESTS.find((one) => one.id === guest.id)?.phone?.country;

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

function membersOf(audience: Audience, groups: readonly Group[], wa?: Category): Members {
  const members = ownMembers(audience, groups);

  return wa == null
    ? members
    : { ...members, fresh: overlaid(members.fresh, wa), invited: overlaid(members.invited, wa) };
}

function ownMembers(audience: Audience, groups: readonly Group[]): Members {
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
  pills: readonly { channel: InviteChannel; count: number }[];
  cant: number;
  cantNames: readonly Untellable[];
  cantAll: readonly Untellable[];
  credits: string | null;
  /** sc-3950's reach line and sc-3954's instead line, while WhatsApp is ticked (sc-45251). */
  whatsApp: string | null;
  instead: string | null;
  /** Too few credits for the WhatsApp invitations (sc-3963): what waits, and email going either way. */
  waits: Waits | null;
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

/** WhatsApp's own reason it cannot go to them; US numbers only while the template is marketing (pm #45460). */
function notByWhatsApp(guest: OneGuest, wa: Category): string | null {
  const sample = waSampleOf(guest, wa);

  if (!guest.mobile) return null;
  if (sample == null || sample.consent === 'none') return MW.hasNotAgreedWhatsApp;
  if (sample.consent === 'stopped') return MW.stoppedWhatsApp;

  return wa === 'marketing' && sample.country === 'US' ? MW.hasUsNumber : null;
}

/** How each channel goes to one guest: WhatsApp in place of a text, never both. */
function byOf(
  guest: OneGuest,
  ticks: Ticks,
  wa: Category | undefined,
): Record<InviteChannel, boolean> {
  const whatsApp = wa != null && ticks.whatsApp && guest.mobile && notByWhatsApp(guest, wa) == null;

  return {
    email: ticks.email && guest.email,
    sms: ticks.sms && guest.mobile && !whatsApp,
    whatsApp,
  };
}

export function goesByWhatsApp(guest: OneGuest, ticks: Ticks, wa?: Category): boolean {
  return byOf(guest, ticks, wa).whatsApp;
}

export function goesBySms(guest: OneGuest, ticks: Ticks, wa?: Category): boolean {
  return byOf(guest, ticks, wa).sms;
}

function whyNot(guest: OneGuest, ticks: Ticks, wa?: Category): string[] {
  const notWa = wa != null && ticks.whatsApp ? notByWhatsApp(guest, wa) : null;

  return [
    ...(guest.email ? [] : [MW.noEmail]),
    ...(guest.mobile ? (ticks.sms ? [] : [MW.smsIsOff]) : [MW.noPhone]),
    ...(notWa == null ? [] : [notWa]),
  ];
}

function reaches(guest: OneGuest, ticks: Ticks, wa?: Category): boolean {
  const by = byOf(guest, ticks, wa);

  return by.email || by.sms || by.whatsApp;
}

export interface InviteReach {
  whatsApp: string | null;
  instead: string | null;
}

function reachOf(people: readonly OneGuest[], ticks: Ticks, wa: Category | undefined): InviteReach {
  if (wa == null || !ticks.whatsApp) return { whatsApp: null, instead: null };

  const why = (word: string) => people.filter((one) => notByWhatsApp(one, wa) === word).length;
  const by = people.filter((one) => byOf(one, ticks, wa).whatsApp).length;

  return {
    whatsApp: reachWords({
      reaches: by,
      of: people.length,
      noMobile: people.filter((one) => !one.mobile).length,
      stopped: why(MW.stoppedWhatsApp),
      notAgreed: why(MW.hasNotAgreedWhatsApp),
      usNumbers: why(MW.hasUsNumber),
    }),
    instead: ticks.sms && by > 0 ? mw.many('insteadOfSms', by) : null,
  };
}

export function inviteReachOf(
  audience: Audience,
  wa: Category | undefined,
  ticks: Ticks,
  groups: readonly Group[] = [],
): InviteReach {
  return reachOf(membersOf(audience, groups, wa).fresh, ticks, wa);
}

/** The check before an invitation goes, or why it cannot: the note first, then reach (sc-3971). */
export function inviteCheckOf(
  audience: Audience,
  ticks: Ticks,
  again: boolean,
  counted: Counted,
  balance: number,
  groups: readonly Group[] = [],
  wa?: Category,
): InviteCheck | InviteRefusal {
  const members = membersOf(audience, groups, wa);
  const everyone = again || members.fresh.length === 0;
  const individuals =
    everyone && !members.counted ? [...members.invited, ...members.fresh] : members.fresh;
  const base = everyone && members.counted && members.already > 0 ? counted : null;
  const count = (everyone ? members.already : 0) + members.fresh.length;
  const on = inviteChannelsOf(wa).filter((channel) => ticks[channel]);
  const people = (channel: InviteChannel) =>
    individuals.filter((guest) => byOf(guest, ticks, wa)[channel]).length +
    (base?.counts[channel] ?? 0);
  const cantPeople = individuals.filter((guest) => !reaches(guest, ticks, wa));
  const cantAll = [
    ...(base?.names ?? []),
    ...cantPeople.map((guest) => ({ name: guest.name, why: whyNot(guest, ticks, wa) })),
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

  const texted = individuals.filter((guest) => byOf(guest, ticks, wa).sms);
  const credits = !ticks.sms
    ? 0
    : members.counted
      ? texted.length + (base?.counts.sms ?? 0)
      : textsCredits(texted.map((guest) => weddingText(guest, wa)));
  const messages =
    wa == null
      ? 0
      : individuals
          .filter((guest) => byOf(guest, ticks, wa).whatsApp)
          .reduce(
            (sum, guest) => sum + whatsAppCreditsIn(waSampleOf(guest, wa)?.country ?? '', wa),
            0,
          );
  const pills = on.map((channel) => ({ channel, count: people(channel) }));
  const short = messages > 0 && credits + messages > balance;

  return {
    kind: 'check',
    count,
    already: members.already,
    named: alreadyAll.slice(0, 2),
    alreadyAll,
    choose: members.already > 0 && members.fresh.length > 0,
    pills,
    cant: on.length === 0 ? 0 : cant,
    cantNames: on.length === 0 ? [] : cantNames,
    cantAll: on.length === 0 ? [] : cantAll,
    credits:
      on.length === 0 || short
        ? null
        : credits + messages === 0
          ? MW.emailNoCredits
          : creditsLine(credits, messages, balance),
    ...reachOf(individuals, ticks, wa),
    waits: short ? waitsOf({ pills }, ticks) : null,
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
  /** sc-45251: WhatsApp is offered, Soirely's template approved in this category. */
  wa?: Category;
  noReplyBy?: boolean;
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

export type InviteState =
  (typeof INVITE_STATES)[number]['key'] | (typeof WA_INVITE_STATES)[number]['key'];

export function isInviteState(key: string): key is InviteState {
  return [...INVITE_STATES, ...WA_INVITE_STATES].some((one) => one.key === key);
}

const EVENT_DAY = '2026-11-05T12:00:00Z';
const REPLY_DAY = '2026-11-04T12:00:00Z';
const WA_LOCALES = { en: 'en-GB', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT' } as const;

type WaLanguage = keyof typeof WA_INVITATION;

function isWaLanguage(code: string): code is WaLanguage {
  return code in WA_INVITATION;
}

/** Soirely's WhatsApp template for one guest, in their language: Intl's long dates and the hosts joined as that language joins them. */
export function whatsAppInvitationOf(
  guest: OneGuest,
  noReplyBy: boolean,
): { lang: WaLanguage; lines: readonly string[]; button: string } {
  const code = WA_SAMPLE[guest.id]?.language ?? 'en';
  const lang = isWaLanguage(code) ? code : 'en';
  const words = WA_INVITATION[lang];
  const locale = WA_LOCALES[lang];
  const long = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(iso));
  const hosts = new Intl.ListFormat(locale, { type: 'conjunction' }).format(HOSTS.split(' and '));

  return {
    lang,
    lines: [
      mw.filled(words.dear, { greeting: greetingOf(guest) }),
      mw.filled(words.invitation, { hosts, event: EVENT_NAME, date: long(EVENT_DAY) }),
      noReplyBy ? words.noDate : mw.filled(words.replyBy, { replyBy: long(REPLY_DAY) }),
    ],
    button: words.button,
  };
}

export type InviteSeed =
  | {
      kind: 'draft';
      to: Audience;
      step: 'write' | 'preview' | 'check';
      openTo: boolean;
      invite: InviteDraft;
      ticks?: Ticks;
      balance?: number;
    }
  | { kind: 'reached'; of: WhatsAppInviteOf }
  | {
      kind: 'out';
      to: Audience;
      stage: 'countdown' | 'sent';
      left: number;
      invite: Pick<InviteOut, 'note'>;
    };

const NO_NOTE: InviteDraft = { note: '', again: false, wrong: false, pressed: false };
const WITH_NOTE: InviteDraft = { ...NO_NOTE, note: NOTE };
const ALL_THREE: Ticks = { email: true, sms: true, whatsApp: true };
const NO_SMS: Ticks = { email: true, sms: false, whatsApp: true };

export function inviteSeedOf(state: string | null): InviteSeed | null {
  const draft = (
    to: Audience,
    step: 'write' | 'preview' | 'check',
    invite: InviteDraft = NO_NOTE,
    openTo = false,
  ): InviteSeed => ({ kind: 'draft', to, step, openTo, invite });

  const wa: InviteDraft = { ...NO_NOTE, wa: 'marketing' };
  const utility: InviteDraft = { ...NO_NOTE, wa: 'utility' };
  const ticked = (
    step: 'write' | 'preview' | 'check',
    invite: InviteDraft,
    ticks: Ticks,
    balance?: number,
  ): InviteSeed => ({
    kind: 'draft',
    to: NOT_YET_INVITED,
    step,
    openTo: false,
    invite,
    ticks,
    ...(balance == null ? {} : { balance }),
  });

  switch (state) {
    case 'inviteWhatsAppOffered':
      return draft(NOT_YET_INVITED, 'write', wa);
    case 'inviteWhatsApp':
      return ticked('write', wa, NO_SMS);
    case 'inviteWhatsAppUtility':
      return ticked('write', utility, NO_SMS);
    case 'inviteWhatsAppSms':
      return ticked('write', wa, ALL_THREE);
    case 'inviteCheckWhatsApp':
      return ticked('check', wa, ALL_THREE);
    case 'inviteCheckWhatsAppUtility':
      return ticked('check', utility, ALL_THREE);
    case 'inviteCheckWhatsAppWaits':
      return ticked('check', wa, NO_SMS, 0);
    case 'invitePreviewWhatsApp':
      return ticked('preview', { ...wa, previewAs: 'chuka-nwankwo' }, ALL_THREE);
    case 'invitePreviewWhatsAppNoDate':
      return ticked('preview', { ...wa, previewAs: 'chuka-nwankwo', noReplyBy: true }, ALL_THREE);
    case 'invitePreviewWhatsAppPt':
      return ticked('preview', { ...wa, previewAs: 'catarina-reis' }, ALL_THREE);
    case 'invitePreviewWhatsAppEs':
      return ticked('preview', { ...wa, previewAs: 'noor-rahman' }, ALL_THREE);
    case 'invitePreviewWhatsAppFr':
      return ticked('preview', { ...wa, previewAs: 'dami-oladipo' }, ALL_THREE);
    case 'invitedReachedWhatsApp':
      return { kind: 'reached', of: 'whatsAppInvite' };
    case 'invitedReachedWhatsAppNoSms':
      return { kind: 'reached', of: 'whatsAppInviteNoSms' };
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
    case 'invitePreviewUnicode':
      return draft(guestAudience('lucia'), 'preview', {
        ...NO_NOTE,
        again: true,
        previewAs: 'lucia',
      });
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
