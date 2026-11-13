import { demoWords } from './demoWords.ts';
import { type Guest, WEDDING, guestsNow, invitationLine, invitedLine, peopleOf } from './guests.ts';
import { LW } from './makeLiveWords.ts';
import {
  type Category,
  type Channel,
  type ConvoId,
  type Draft,
  type Inbox,
  type Out,
  type Ticks,
  type Untellable,
  BALANCE,
  EVENT_NAME,
  HOSTS,
  INVITE,
  NOW,
  ORGANISATION,
  THEIR_LINK,
  figuresOf,
  reachWords,
  whatsAppCreditsIn,
} from './messages.ts';
import { type Waits, waitsOf } from './messagesWaits.ts';
import {
  type Audience,
  type Condition,
  type Group,
  audienceWords,
  toLine,
  whoMatches,
} from './messagesTo.ts';
import { INVITE_STATES, IW, WA_INVITATION, WA_INVITE_STATES } from './messagesInviteWords.ts';
import { MW } from './messagesWords.ts';

export { INVITE_STATES, IW };

export const iw = demoWords(IW);
const lw = demoWords(LW);
const mw = demoWords(MW);
const NUMBER = new Intl.NumberFormat('en-US');

export type InviteState =
  (typeof INVITE_STATES)[number]['key'] | (typeof WA_INVITE_STATES)[number]['key'];

export function isInviteState(state: string | null): state is InviteState {
  return [...INVITE_STATES, ...WA_INVITE_STATES].some((one) => one.key === state);
}

export const NOT_INVITED: Audience = { kind: 'who', conditions: ['notInvited'] };
export const NOTE_MOST = 10000;
export const REPLY_BY = 'Wednesday, Nov 4';
export const SENT_ON = '2026-11-03';
const PARTS_PER_TEXT = 2;
const LINK_CHARS = 'https://soirely.app/i/Qm7xK2pV'.length;

export const NOTE =
  'We would love you there with us. Children are very welcome, and there is a quiet room by the cloakroom for little ones who need a rest.\nAdaeze & Tunde';

const LONG_PART = [
  'We are so happy to invite you, and we wanted to tell you a little about the day before it comes.',
  'The ceremony is in the Grand Hall on the ground floor, with step-free access from Marylebone Road. Doors open at 17:30, and we will start at 18:00 sharp, so please give yourselves time for the traffic on a Thursday evening. There is a cloakroom by the main doors, and the staff there will hold bags and coats all night.',
  'After the ceremony there are drinks in the Winter Garden while the hall is set for dinner. Dinner is at 20:00, and you will find your table on your own page here once we have shared the tables.',
].join('\n');

export const LONG_NOTE = Array.from({ length: 18 }, () => LONG_PART).join('\n\n');

export interface Invite {
  note: string;
  again: boolean;
  one?: string;
  seeAll?: boolean;
  tooLong?: boolean;
  as?: string;
  /** sc-45251: WhatsApp is offered, its template approved in this category. */
  wa?: Category;
  noReplyBy?: boolean;
}

export interface InviteOut {
  note: string;
  again: boolean;
  count: number;
  reached: number;
  ids: readonly string[];
  greet: string;
  one?: string;
}

export interface InvitePerson {
  id: string;
  name: string;
  greet: string;
  line: string;
  email: boolean;
  mobile: boolean;
  fresh: boolean;
  companion?: boolean;
  language?: { code: string; chose: boolean } | null;
  whatsApp?: { country: string; consent: Consent };
}

type Consent = 'agreed' | 'none' | 'stopped';

/** sc-45251's sample on the wedding's Not yet invited: each mobile number's country and WhatsApp consent. */
const WA_SAMPLE: Readonly<
  Record<string, { country: string; consent: Consent; noEmail?: true; language?: string }>
> = {
  'chuka-nwankwo': { country: 'NG', consent: 'agreed' },
  'dami-oladipo': { country: 'NG', consent: 'agreed' },
  'femi-ogundipe': { country: 'NG', consent: 'agreed' },
  'catarina-reis': { country: 'BR', consent: 'agreed', noEmail: true, language: 'pt' },
  'noor-rahman': { country: 'GB', consent: 'agreed' },
  'kenji-watanabe': { country: 'US', consent: 'agreed' },
  'lina-saleh': { country: 'US', consent: 'agreed' },
  yusuf: { country: 'NG', consent: 'none' },
  'patrice-leroy': { country: 'FR', consent: 'none' },
  'elif-kaya': { country: 'GB', consent: 'stopped' },
};

function withWhatsApp(person: InvitePerson): InvitePerson {
  const sample = WA_SAMPLE[person.id];

  if (sample == null) return person;

  return {
    ...person,
    mobile: true,
    email: person.email && sample.noEmail !== true,
    whatsApp: { country: sample.country, consent: sample.consent },
    ...(sample.language == null ? {} : { language: { code: sample.language, chose: true } }),
  };
}

function personOf(guest: Guest, name: string, line: string | null, fresh: boolean): InvitePerson {
  return {
    id: guest.id,
    name,
    greet: guest.greetAs ?? name,
    line: line ?? '',
    email: guest.email != null,
    mobile: guest.phone != null,
    fresh,
    language:
      guest.chose != null
        ? { code: guest.chose, chose: true }
        : guest.language == null
          ? null
          : { code: guest.language, chose: false },
  };
}

function weddingPeople(wa: boolean): InvitePerson[] {
  const people = peopleOf(guestsNow(WEDDING))
    .filter((one) => one.reply !== 'walkIn')
    .map((one) =>
      one.companion == null
        ? personOf(one.guest, one.name, invitationLine(one.guest), one.reply === 'notYet')
        : {
            id: one.id,
            name: one.name,
            greet: one.name,
            line: invitationLine(one.guest) ?? '',
            email: false,
            mobile: false,
            fresh: one.guest.reply === 'notYet',
            companion: true,
          },
    );

  return wa ? people.map(withWhatsApp) : people;
}

function freshMatches(person: InvitePerson, condition: Condition): boolean {
  switch (condition) {
    case 'notInvited':
      return true;
    case 'hasEmail':
      return person.email;
    case 'hasMobile':
      return person.mobile;
    default:
      return false;
  }
}

const BY_NAME = new Intl.Collator('en', { sensitivity: 'base' });

function byName(a: InvitePerson, b: InvitePerson): number {
  return BY_NAME.compare(a.name, b.name);
}

export interface InviteAudience {
  fresh: readonly InvitePerson[];
  already: readonly InvitePerson[];
  everyone: readonly InvitePerson[];
}

/** Who To holds, split into who is Not yet invited and who already has their invitation: Guests A's list for the guests, B's sample for any other condition. */
export function inviteAudienceOf(
  to: Audience,
  invite: Pick<Invite, 'one' | 'wa'>,
  groups: readonly Group[],
): InviteAudience {
  const people = weddingPeople(invite.wa != null);
  let fresh: InvitePerson[];
  let already: InvitePerson[];

  if (invite.one != null) {
    const one = people.filter((person) => person.id === invite.one);

    fresh = one.filter((person) => person.fresh);
    already = one.filter((person) => !person.fresh);
  } else if (to.kind === 'all') {
    fresh = people.filter((person) => person.fresh);
    already = people.filter((person) => !person.fresh);
  } else {
    const { conditions } = to;

    fresh =
      conditions.length === 0
        ? []
        : people.filter(
            (person) =>
              person.fresh && conditions.every((condition) => freshMatches(person, condition)),
          );
    already = conditions.includes('notInvited')
      ? []
      : whoMatches(conditions, groups).map((sample) => {
          const known = people.find((person) => person.name === sample.name && !person.fresh);

          return (
            known ?? {
              id: sample.name,
              name: sample.name,
              greet: sample.name,
              line: invitedLine({ by: null, how: null, on: '2026-10-12' }),
              email: sample.email,
              mobile: sample.mobile,
              fresh: false,
            }
          );
        });
  }

  return {
    fresh: fresh.sort(byName),
    already: to.kind === 'who' && invite.one == null ? already.sort(byName) : already,
    everyone: [...fresh, ...already].sort(byName),
  };
}

export function inviteChipWords(
  to: Audience,
  invite: Pick<Invite, 'one'>,
  audience: InviteAudience,
): string {
  if (invite.one != null) return audience.everyone[0]?.name ?? '';

  const count = NUMBER.format(audience.everyone.length);

  return to.kind === 'all' ? `${MW.allGuests} · ${count}` : `${audienceWords(to, [])} · ${count}`;
}

export function noteProblem(note: string): string | null {
  return [...note.trim()].length > NOTE_MOST
    ? iw.filled(IW.noteTooLong, { count: NOTE_MOST })
    : null;
}

/** WhatsApp's own reason it cannot go to them; US numbers only while the template is marketing (pm #45460). */
function notByWhatsApp(person: InvitePerson, category: Category): string | null {
  const wa = person.whatsApp;

  if (!person.mobile) return null;
  if (wa == null || wa.consent === 'none') return MW.hasNotAgreedWhatsApp;
  if (wa.consent === 'stopped') return MW.stoppedWhatsApp;

  return category === 'marketing' && wa.country === 'US' ? MW.hasUsNumber : null;
}

/** How each channel goes to one guest: WhatsApp in place of a text, never both. */
function byOf(person: InvitePerson, ticks: Ticks, category: Category | undefined) {
  const whatsApp =
    category != null && ticks.whatsApp && notByWhatsApp(person, category) == null && person.mobile;

  return {
    email: ticks.email && person.email,
    sms: ticks.sms && person.mobile && !whatsApp,
    whatsApp,
  };
}

function whyNot(person: InvitePerson, ticks: Ticks, category: Category | undefined): string[] {
  return [
    person.email ? (ticks.email ? null : IW.emailIsOff) : MW.noEmail,
    person.mobile ? (ticks.sms ? null : MW.smsIsOff) : MW.noPhone,
    category != null && ticks.whatsApp ? notByWhatsApp(person, category) : null,
  ].filter((why): why is string => why != null);
}

function reaches(person: InvitePerson, ticks: Ticks, category?: Category): boolean {
  const by = byOf(person, ticks, category);

  return by.email || by.sms || by.whatsApp;
}

export interface InviteReach {
  whatsApp: string | null;
  instead: string | null;
}

function reachOf(
  people: readonly InvitePerson[],
  ticks: Ticks,
  category: Category | undefined,
): InviteReach {
  if (category == null || !ticks.whatsApp) return { whatsApp: null, instead: null };

  const why = (word: string) =>
    people.filter((one) => notByWhatsApp(one, category) === word).length;
  const by = people.filter((one) => byOf(one, ticks, category).whatsApp).length;

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
  to: Audience,
  invite: Pick<Invite, 'one' | 'wa'>,
  ticks: Ticks,
  groups: readonly Group[],
): InviteReach {
  return reachOf(inviteAudienceOf(to, invite, groups).fresh, ticks, invite.wa);
}

function creditsLine(texts: number, whatsApp: number, balance: number): string {
  const credits = texts + whatsApp;
  const uses =
    texts > 0 && whatsApp > 0
      ? mw.many('textsAndWhatsAppUse', credits)
      : whatsApp > 0
        ? mw.many('whatsAppUse', credits)
        : mw.many('textsUse', credits);

  return `${uses} ${mw.filled(MW.creditsAfter, { count: balance - credits })}`;
}

export interface InviteCheck {
  /** Who it goes to: the button's and the sentence's count. */
  count: number;
  already: number;
  named: readonly InvitePerson[];
  /** Leave them out or Send again: somebody is Not yet invited and somebody already has it. */
  choice: boolean;
  pills: readonly { channel: Channel; count: number }[];
  cant: number;
  cantNamed: readonly Untellable[];
  credits: string | null;
  reached: number;
  refused: boolean;
  ids: readonly string[];
  whatsApp: string | null;
  instead: string | null;
  /** Too few credits (sc-3963): what waits, and email going either way. */
  waits: Waits | null;
}

/** The check on an invitation: Guests A's people Not yet invited, and B's own figures for anyone already invited it goes to again. */
export function inviteCheckOf(
  to: Audience,
  invite: Pick<Invite, 'one' | 'again' | 'wa'>,
  ticks: Ticks,
  groups: readonly Group[],
  balance = BALANCE,
): InviteCheck {
  const category = invite.wa;
  const audience = inviteAudienceOf(to, invite, groups);
  const { fresh, already } = audience;
  const again = already.length > 0 && (invite.again || fresh.length === 0);
  const sample = again && invite.one == null;
  const own = [...fresh, ...(again && !sample ? already : [])];
  const figures = sample ? figuresOf(to, { ...ticks, whatsApp: false }) : null;
  const ownCant = own.filter((person) => !reaches(person, ticks, category));
  const by = own.map((person) => ({ person, by: byOf(person, ticks, category) }));
  const email =
    by.filter((one) => one.by.email).length + (ticks.email ? (figures?.counts.email ?? 0) : 0);
  const sms = by.filter((one) => one.by.sms).length + (ticks.sms ? (figures?.counts.sms ?? 0) : 0);
  const whatsApp = by.filter((one) => one.by.whatsApp);
  const count = fresh.length + (again ? already.length : 0);
  const cant = ownCant.length + (figures?.cantTell ?? 0);
  const texts = sms * PARTS_PER_TEXT;
  const messages =
    category == null
      ? 0
      : whatsApp.reduce(
          (sum, one) => sum + whatsAppCreditsIn(one.person.whatsApp?.country ?? '', category),
          0,
        );
  const on = (['email', 'sms', 'whatsApp'] as const).filter((channel) => ticks[channel]);
  const pills = on.map((channel) => ({
    channel,
    count: channel === 'email' ? email : channel === 'sms' ? sms : whatsApp.length,
  }));
  const short = texts + messages > balance;
  const reach = reachOf(own, ticks, category);

  return {
    count,
    already: already.length,
    named: already.filter((person) => person.companion !== true).slice(0, 2),
    choice: fresh.length > 0 && already.length > 0,
    pills,
    cant,
    cantNamed: [
      ...ownCant.map((person) => ({ name: person.name, why: whyNot(person, ticks, category) })),
      ...(figures?.names ?? []),
    ].slice(0, 2),
    credits:
      on.length === 0 || short
        ? null
        : texts + messages === 0
          ? MW.emailNoCredits
          : creditsLine(texts, messages, balance),
    reached: count - cant,
    refused: count - cant <= 0,
    ids: own.filter((person) => reaches(person, ticks, category)).map((person) => person.id),
    ...reach,
    waits: short ? waitsOf({ pills }, ticks) : null,
  };
}

export function refusalTitle(count: number): string {
  return lw.many('cannotTitle', count);
}

export function refusalLine(count: number): string {
  return lw.many('nobody', count);
}

export function inviteLines(greet: string): { title: string; lines: string[] } {
  return {
    title: mw.filled(MW.inviteSubject, { event: EVENT_NAME, hosts: HOSTS }),
    lines: [
      mw.filled(MW.dear, { greeting: greet }),
      mw.filled(MW.invitedOn, { event: EVENT_NAME, date: INVITE.date }),
      mw.filled(MW.willYou, { replyBy: REPLY_BY }),
      [MW.replyYes, MW.replyNo, MW.replyNotSure].join(' · '),
    ],
  };
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
  person: InvitePerson,
  noReplyBy: boolean,
): { lang: WaLanguage; lines: readonly string[]; button: string } {
  const code = person.language?.code ?? 'en';
  const lang = isWaLanguage(code) ? code : 'en';
  const words = WA_INVITATION[lang];
  const locale = WA_LOCALES[lang];
  const long = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(iso));
  const hosts = new Intl.ListFormat(locale, { type: 'conjunction' }).format(HOSTS.split(' and '));

  return {
    lang,
    lines: [
      mw.filled(words.dear, { greeting: person.greet }),
      mw.filled(words.invitation, { hosts, event: EVENT_NAME, date: long(EVENT_DAY) }),
      noReplyBy ? words.noDate : mw.filled(words.replyBy, { replyBy: long(REPLY_DAY) }),
    ],
    button: words.button,
  };
}

export function goesByWhatsApp(person: InvitePerson, ticks: Ticks, category?: Category): boolean {
  return byOf(person, ticks, category).whatsApp;
}

export function goesBySms(person: InvitePerson, ticks: Ticks, category?: Category): boolean {
  return byOf(person, ticks, category).sms;
}

export function emailLines(): { from: string; foot: readonly string[]; stop: string } {
  return {
    from: mw.filled(MW.emailFrom, { organisation: HOSTS }),
    foot: [
      IW.eachAnswer,
      IW.yoursAlone,
      iw.filled(IW.sentBecause, { organisation: ORGANISATION, event: EVENT_NAME }),
    ],
    stop: mw.filled(MW.stopEmails, { organisation: ORGANISATION }),
  };
}

/** The text in plain punctuation, so it stays in GSM-7 (one part to 160, then 153 a part), counted with their short link. */
export function smsOf(name: string): { text: string; chars: number; parts: number } {
  const text = iw
    .filled(IW.smsLine, {
      hosts: HOSTS,
      name,
      event: EVENT_NAME,
      date: INVITE.date,
      replyBy: REPLY_BY,
      link: THEIR_LINK,
    })
    .replaceAll('’', "'");
  const chars = text.length - THEIR_LINK.length + LINK_CHARS;

  return { text, chars, parts: chars <= 160 ? 1 : Math.ceil(chars / 153) };
}

export function inviteDraftOf(invite: Invite, step: Draft['step'], thread: ConvoId = 'new'): Draft {
  return {
    thread,
    to: NOT_INVITED,
    ticks: { email: true, sms: true, whatsApp: false },
    subject: MW.invitation,
    body: [],
    step,
    seed: 0,
    invite,
  };
}

export function inviteToLine(
  to: Audience,
  one: string | undefined,
  groups: readonly Group[],
): string {
  if (one == null) return toLine(to, groups);

  const name = inviteAudienceOf(to, { one }, groups).everyone[0]?.name ?? '';

  return mw.filled(MW.toAudience, { audience: name });
}

/** The invitation as it goes: the reach is counted once, at Send, from the check. */
export function inviteGoing(draft: Draft, groups: readonly Group[]): InviteOut | undefined {
  const invite = draft.invite;

  if (invite == null) return undefined;

  const check = inviteCheckOf(draft.to, invite, draft.ticks, groups);
  const audience = inviteAudienceOf(draft.to, invite, groups);

  return {
    note: invite.note,
    again: invite.again,
    count: check.count,
    reached: check.reached,
    ids: check.ids,
    greet: audience.everyone[0]?.greet ?? '',
    ...(invite.one == null ? {} : { one: invite.one }),
  };
}

const ALL_THREE: Ticks = { email: true, sms: true, whatsApp: true };
const NO_SMS: Ticks = { email: true, sms: false, whatsApp: true };

function seedDraft(state: InviteState): Draft | null {
  const fresh: Invite = { note: '', again: false };
  const wa: Invite = { ...fresh, wa: 'marketing' };
  const utility: Invite = { ...fresh, wa: 'utility' };
  const ticked = (draft: Draft, ticks: Ticks): Draft => ({ ...draft, ticks });

  switch (state) {
    case 'inviteWhatsAppOffered':
      return inviteDraftOf(wa, 'write');
    case 'inviteWhatsApp':
      return ticked(inviteDraftOf(wa, 'write'), NO_SMS);
    case 'inviteWhatsAppUtility':
      return ticked(inviteDraftOf(utility, 'write'), NO_SMS);
    case 'inviteWhatsAppSms':
      return ticked(inviteDraftOf(wa, 'write'), ALL_THREE);
    case 'inviteCheckWhatsApp':
      return ticked(inviteDraftOf(wa, 'check'), ALL_THREE);
    case 'inviteCheckWhatsAppUtility':
      return ticked(inviteDraftOf(utility, 'check'), ALL_THREE);
    case 'inviteCheckWhatsAppWaits':
      return ticked(inviteDraftOf(wa, 'check'), NO_SMS);
    case 'invitePreviewWhatsApp':
      return ticked(inviteDraftOf({ ...wa, as: 'chuka-nwankwo' }, 'preview'), ALL_THREE);
    case 'invitePreviewWhatsAppNoDate':
      return ticked(
        inviteDraftOf({ ...wa, as: 'chuka-nwankwo', noReplyBy: true }, 'preview'),
        ALL_THREE,
      );
    case 'invitePreviewWhatsAppPt':
      return ticked(inviteDraftOf({ ...wa, as: 'catarina-reis' }, 'preview'), ALL_THREE);
    case 'inviteWrite':
      return inviteDraftOf(fresh, 'write');
    case 'inviteWriteOne':
      return inviteDraftOf({ ...fresh, one: 'bisi' }, 'write');
    case 'inviteNote':
      return inviteDraftOf({ ...fresh, note: NOTE }, 'write');
    case 'inviteNoteLong':
      return inviteDraftOf({ ...fresh, note: LONG_NOTE, tooLong: true }, 'write');
    case 'invitePreview':
      return inviteDraftOf(fresh, 'preview');
    case 'invitePreviewNote':
      return inviteDraftOf({ ...fresh, note: NOTE }, 'preview');
    case 'invitePreviewSms':
      return inviteDraftOf({ ...fresh, as: 'yusuf' }, 'preview');
    case 'inviteCheck':
      return inviteDraftOf(fresh, 'check');
    case 'inviteCheckSome':
      return { ...inviteDraftOf(fresh, 'check'), to: { kind: 'all' } };
    case 'inviteCheckAgain':
      return { ...inviteDraftOf({ ...fresh, again: true }, 'check'), to: { kind: 'all' } };
    case 'inviteCheckSeeAll':
      return { ...inviteDraftOf({ ...fresh, seeAll: true }, 'check'), to: { kind: 'all' } };
    case 'inviteCheckAll':
      return inviteDraftOf({ ...fresh, one: 'emeka' }, 'check');
    case 'inviteRefused':
      return inviteDraftOf({ ...fresh, one: 'joaquin' }, 'check');
    default:
      return null;
  }
}

/** Each invitation state's inbox, on top of B's own. */
export function inviteSeedOf(state: InviteState, base: Inbox): Inbox {
  const draft = seedDraft(state);

  if (draft != null)
    return {
      ...base,
      pane: { kind: 'compose' },
      draft,
      ...(state === 'inviteCheckWhatsAppWaits' ? { balance: 0 } : {}),
    };
  if (state === 'invitedReachedWhatsApp' || state === 'invitedReachedWhatsAppNoSms')
    return {
      ...base,
      pane: {
        kind: 'reached',
        of: state === 'invitedReachedWhatsApp' ? 'whatsAppInvite' : 'whatsAppInviteNoSms',
        thread: 'invite',
      },
    };

  const going = inviteDraftOf({ note: NOTE, again: false }, 'check');
  const invite = inviteGoing(going, []);
  const out: Out = {
    thread: 'new',
    subject: MW.invitation,
    body: [],
    to: NOT_INVITED,
    ticks: going.ticks,
    stage: state === 'inviteCountdown' ? 'countdown' : 'sent',
    left: 7,
    at: NOW,
    seen: 3,
    ...(invite == null ? {} : { invite }),
  };

  return { ...base, pane: { kind: 'convo', id: 'new' }, outs: [out] };
}
