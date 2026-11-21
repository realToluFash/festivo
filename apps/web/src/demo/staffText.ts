import { phoneFields } from '@soirely/domain';

import { demoWords } from './demoWords.ts';
import { sampleEvent } from './events.ts';
import { type InviteSms, THEIR_LINK, asSent } from './inviteSms.ts';
import { MW } from './messagesWords.ts';
import { type Entry, ORGANISATION } from './roster.ts';
import { textCredits } from './smsCredits.ts';
import { NOW_AT, YOU } from './staffLink.ts';
import { STATIONS_EVENT } from './stations.ts';

/** sc-77904's words as the AC quotes [en]'s #77928, #77937 and #77953; [bracketed] ones are the drawing's, waiting for [en]. */
export interface TextWords {
  text: string;
  bulk: (n: number) => string;
  sending: string;
  held: string;
  waits: (time: string) => string;
  notDelivered: (time: string) => string;
  stopped: string;
  sendingTo: (name: string) => string;
  checkOne: (name: string) => string;
  checkMany: (n: number) => string;
  checkLine: string;
  thisTextUses: (c: number) => string;
  textsUse: (c: number) => string;
  after: (c: number) => string;
  smsWaits: (w: number) => string;
  quiet: (count: number, time: string) => string;
  addCredits: string;
  askOwner: string;
  cancel: string;
  allSent: string;
  result: (r: Result) => string[];
  noMobile: (m: number) => string;
  stoppedCount: (k: number) => string;
}

export interface Result {
  sending: number;
  m: number;
  k: number;
  held: number;
  waits: number;
  time: string;
}

/** sc-77904's own words, each count a plural family; the check's lines are sc-3917's (MW). */
const STAFF_TEXT = {
  text: 'Text the link',
  bulk_one: 'Text links to {{count, number}}',
  bulk_other: 'Text links to {{count, number}}',
  sending: 'Sending text…',
  held: 'Text held: no credits',
  waits: 'Text waits until {{time}}, their time',
  notDelivered: 'Text not delivered · {{time}}',
  stopped: 'Stopped texts',
  sendingToName: 'Sending the link to {{name}}.',
  checkOne: '[Text the link to {{name}}?]',
  checkMany_one: '[Text links to {{count, number}} person?]',
  checkMany_other: '[Text links to {{count, number}} people?]',
  checkLine: '[Each gets a text with their own link. Links sent before keep working.]',
  askOwner: 'Ask an owner',
  allSent: '[Next: nothing. Everyone with a number has been sent a link.]',
  sendingTo_one: 'Sending to {{count, number}} person.',
  sendingTo_other: 'Sending to {{count, number}} people.',
  noMobile_one: '{{count, number}} has no mobile number.',
  noMobile_other: '{{count, number}} have no mobile number.',
  stoppedTexts_one: '{{count, number}} has stopped texts.',
  stoppedTexts_other: '{{count, number}} have stopped texts.',
  heldCount_one: '{{count, number}} held: no credits.',
  heldCount_other: '{{count, number}} held: no credits.',
  waitCount_one: '{{count, number}} waits until {{time}}, their time.',
  waitCount_other: '{{count, number}} wait until {{time}}, their time.',
};

const EN_WORDS = {
  ...STAFF_TEXT,
  noticeTextUses_one: MW.noticeTextUses_one,
  noticeTextUses_other: MW.noticeTextUses_other,
  textsUse_one: MW.textsUse_one,
  textsUse_other: MW.textsUse_other,
  creditsAfter: MW.creditsAfter,
  smsWaits_one: MW.smsWaits_one,
  smsWaits_other: MW.smsWaits_other,
  quiet_one: MW.quiet_one,
  quiet_other: MW.quiet_other,
  addCredits: MW.addCredits,
  cancel: MW.cancel,
};

type StaffTextWords = Readonly<Record<keyof typeof EN_WORDS, string>>;

const FR_WORDS: StaffTextWords = {
  text: '[Envoyer le lien par SMS]',
  bulk_one: '[Envoyer les liens par SMS à {{count, number}}]',
  bulk_other: '[Envoyer les liens par SMS à {{count, number}}]',
  sending: '[Envoi du SMS…]',
  held: '[SMS en attente : plus de crédits]',
  waits: '[SMS en attente jusqu’à {{time}}, heure locale]',
  notDelivered: '[SMS non distribué · {{time}}]',
  stopped: '[SMS refusés]',
  sendingToName: '[Envoi du lien à {{name}}.]',
  checkOne: '[Envoyer le lien par SMS à {{name}} ?]',
  checkMany_one: '[Envoyer les liens par SMS à {{count, number}} personne ?]',
  checkMany_other: '[Envoyer les liens par SMS à {{count, number}} personnes ?]',
  checkLine:
    '[Chacune reçoit un SMS avec son propre lien. Les liens envoyés avant continuent de fonctionner.]',
  askOwner: '[Demander à un propriétaire]',
  allSent: '[Étape suivante : aucune. Toutes les personnes avec un numéro ont reçu un lien.]',
  sendingTo_one: '[Envoi à {{count, number}} personne.]',
  sendingTo_other: '[Envoi à {{count, number}} personnes.]',
  noMobile_one: '[{{count, number}} n’a pas de numéro de portable.]',
  noMobile_other: '[{{count, number}} n’ont pas de numéro de portable.]',
  stoppedTexts_one: '[{{count, number}} a refusé les SMS.]',
  stoppedTexts_other: '[{{count, number}} ont refusé les SMS.]',
  heldCount_one: '[{{count, number}} en attente : plus de crédits.]',
  heldCount_other: '[{{count, number}} en attente : plus de crédits.]',
  waitCount_one: '[{{count, number}} en attente jusqu’à {{time}}, heure locale.]',
  waitCount_other: '[{{count, number}} en attente jusqu’à {{time}}, heure locale.]',
  noticeTextUses_one: '[Ce SMS utilise {{count, number}} crédit.]',
  noticeTextUses_other: '[Ce SMS utilise {{count, number}} crédits.]',
  textsUse_one: '[Les SMS utilisent {{count, number}} crédit.]',
  textsUse_other: '[Les SMS utilisent {{count, number}} crédits.]',
  creditsAfter: '[Crédits après l’envoi : {{count, number}}.]',
  smsWaits_one: '[{{count, number}} SMS attendra des crédits.]',
  smsWaits_other: '[{{count, number}} SMS attendront des crédits.]',
  quiet_one: '[Les SMS à {{count, number}} personne attendent {{time}}, heure locale.]',
  quiet_other: '[Les SMS à {{count, number}} personnes attendent {{time}}, heure locale.]',
  addCredits: '[Ajouter des crédits]',
  cancel: 'Annuler',
};

function textWordsOf(words: StaffTextWords, locale: string): TextWords {
  const { filled, many } = demoWords(words, { locale });

  return {
    text: words.text,
    bulk: (n) => many('bulk', n),
    sending: words.sending,
    held: words.held,
    waits: (time) => filled(words.waits, { time }),
    notDelivered: (time) => filled(words.notDelivered, { time }),
    stopped: words.stopped,
    sendingTo: (name) => filled(words.sendingToName, { name }),
    checkOne: (name) => filled(words.checkOne, { name }),
    checkMany: (n) => many('checkMany', n),
    checkLine: words.checkLine,
    thisTextUses: (c) => many('noticeTextUses', c),
    textsUse: (c) => many('textsUse', c),
    after: (c) => filled(words.creditsAfter, { count: c }),
    smsWaits: (w) => many('smsWaits', w),
    quiet: (n, time) => many('quiet', n, { time }),
    addCredits: words.addCredits,
    askOwner: words.askOwner,
    cancel: words.cancel,
    allSent: words.allSent,
    noMobile: (m) => many('noMobile', m),
    stoppedCount: (k) => many('stoppedTexts', k),
    result: (r) => [
      ...(r.sending > 0 ? [many('sendingTo', r.sending)] : []),
      ...(r.m > 0 ? [many('noMobile', r.m)] : []),
      ...(r.k > 0 ? [many('stoppedTexts', r.k)] : []),
      ...(r.held > 0 ? [many('heldCount', r.held)] : []),
      ...(r.waits > 0 ? [many('waitCount', r.waits, { time: r.time })] : []),
    ],
  };
}

export const TW = textWordsOf(EN_WORDS, 'en-GB');

export const TEXT_WORDS: Record<'en' | 'fr' | 'es' | 'pt', TextWords> = {
  en: TW,
  fr: textWordsOf(FR_WORDS, 'fr-FR'),
  es: TW,
  pt: TW,
};

export const BALANCE = 1500;
export const QUIET_ENDS = '09:00';
export const SENT_MS = 2400;

export interface Texting {
  credits: number;
  refused: boolean;
  undelivered: boolean;
  /** Outside 09:00–20:00 their time, with the event not Happening now and no shift before 09:00 (pm, #77935). */
  quiet: boolean;
  clock: string;
  billing: boolean;
}

export function texting(over: Partial<Texting> = {}): Texting {
  return {
    credits: BALANCE,
    refused: false,
    undelivered: false,
    quiet: false,
    clock: NOW_AT,
    billing: true,
    ...over,
  };
}

/** Text the link: a number that has not stopped texts, with no text sending or waiting. */
export function textable(entry: Entry): boolean {
  return entry.mobile != null && entry.stopped !== true && entry.pending == null;
}

/** {n}: textable, reading No link yet, Copied or Shared. */
export function owed(entry: Entry): boolean {
  return (
    textable(entry) && (entry.link === 'none' || entry.link === 'copied' || entry.link === 'shared')
  );
}

export interface Check {
  n: number;
  m: number;
  k: number;
  afford: number;
  uses: number;
  after: number;
  wait: number;
}

/** The text in the event's language, the first form that fits one part, as [en] settled them (#77928). */
const STAFF_SMS = {
  full: 'Your staff link for {{event}} from {{org}}: {{link}}',
  noEvent: 'Your staff link from {{org}}: {{link}}',
  bare: 'Your staff link: {{link}}',
};
const sms = demoWords(STAFF_SMS);

/** A first text from the organisation to a number ends on the STOP line, which may take it to two parts. */
export function staffSmsOf(first: boolean): InviteSms {
  const slots = {
    event: sampleEvent(STATIONS_EVENT)?.name ?? '',
    org: ORGANISATION,
    link: THEIR_LINK,
  };
  const forms = [STAFF_SMS.full, STAFF_SMS.noEvent, STAFF_SMS.bare].map((form) =>
    sms.filled(form, slots),
  );
  const fits =
    forms.find((words) => asSent(words).parts === 1) ?? sms.filled(STAFF_SMS.bare, slots);

  return asSent(fits, first);
}

/** sc-3928's rate for the person's own number, times the parts of their text. */
export function creditsOf(entry: Entry): number {
  const country = entry.mobile == null ? null : phoneFields(entry.mobile)?.country;
  if (country == null) throw new Error(`No number to text for ${entry.name}`);

  return textCredits({ parts: staffSmsOf(entry.trail?.via !== 'text').parts, country });
}

/** How many of the texts, in order, the credits pay for. */
function affordable(costs: readonly number[], credits: number): number {
  let left = credits;
  const paid = costs.findIndex((cost) => {
    left -= cost;
    return left < 0;
  });

  return paid === -1 ? costs.length : paid;
}

const total = (costs: readonly number[]) => costs.reduce((sum, cost) => sum + cost, 0);
const noMobileIn = (entries: readonly Entry[]) =>
  entries.filter((one) => one.mobile == null && one.link === 'none').length;
const stoppedIn = (entries: readonly Entry[]) =>
  entries.filter((one) => one.mobile != null && one.stopped === true).length;

export function checkOf(due: readonly Entry[], others: readonly Entry[], t: Texting): Check {
  const costs = due.map(creditsOf);
  const afford = affordable(costs, t.credits);
  const uses = total(costs.slice(0, afford));

  return {
    n: due.length,
    m: noMobileIn(others),
    k: stoppedIn(others),
    afford,
    uses,
    after: t.credits - uses,
    wait: due.length - afford,
  };
}

export function bulkCheck(entries: readonly Entry[], t: Texting): Check {
  return checkOf(entries.filter(owed), entries, t);
}

/** Pressed: each text sends, waits for credits, or waits for 09:00; the result counts each person in one line. */
export function textSome(
  entries: readonly Entry[],
  ids: readonly string[],
  t: Texting,
): { entries: Entry[]; credits: number; result: Result } {
  const due = ids.flatMap((id) => entries.filter((one) => one.id === id));
  const costs = due.map(creditsOf);
  const afford = t.quiet ? 0 : affordable(costs, t.credits);
  const order = due.map((one) => one.id);
  const go = new Set(order.slice(0, afford));
  const held = new Set(t.quiet ? [] : order.slice(afford));
  const waits = new Set(t.quiet ? order : []);
  const pending = (id: string): Entry['pending'] =>
    go.has(id) ? 'sending' : held.has(id) ? 'held' : waits.has(id) ? 'waits' : undefined;

  return {
    entries: entries.map((one) => {
      const now = pending(one.id);
      return now == null ? one : { ...one, pending: now, undelivered: null };
    }),
    credits: t.credits - total(costs.slice(0, go.size)),
    result: {
      sending: go.size,
      m: noMobileIn(entries),
      k: stoppedIn(entries),
      held: held.size,
      waits: waits.size,
      time: QUIET_ENDS,
    },
  };
}

/** Twilio reports sent: Link sent by you, unless already opened, since the status only moves forward. */
export function reported(entry: Entry, t: Texting): Entry {
  if (entry.pending !== 'sending') return entry;
  if (entry.link === 'opened') return { ...entry, pending: undefined };

  return {
    ...entry,
    pending: undefined,
    link: 'sent',
    trail: { by: YOU, at: t.clock, via: 'text' },
    ...(t.undelivered ? { before: { link: entry.link, trail: entry.trail ?? null } } : {}),
  };
}

/** Twilio reports undelivered: the row reads what its other deliveries make it, with the time it failed. */
export function bounced(entry: Entry): Entry {
  if (entry.before == null) return entry;

  return {
    ...entry,
    link: entry.before.link,
    trail: entry.before.trail,
    before: undefined,
    undelivered: NOW_AT,
  };
}
