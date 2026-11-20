import type { Entry } from './roster.ts';
import { NOW_AT, YOU } from './staffLink.ts';

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

const one = (n: number, single: string, many: string) => (n === 1 ? single : many);
const count = (n: number) => n.toLocaleString('en-GB');

export const TW: TextWords = {
  text: 'Text the link',
  bulk: (n) => `Text links to ${n}`,
  sending: 'Sending text…',
  held: 'Text held: no credits',
  waits: (time) => `Text waits until ${time}, their time`,
  notDelivered: (time) => `Text not delivered · ${time}`,
  stopped: 'Stopped texts',
  sendingTo: (name) => `Sending the link to ${name}.`,
  checkOne: (name) => `[Text the link to ${name}?]`,
  checkMany: (n) => `[Text links to ${n} ${one(n, 'person', 'people')}?]`,
  checkLine: '[Each gets a text with their own link. Links sent before keep working.]',
  thisTextUses: (c) => `This text uses ${count(c)} ${one(c, 'credit', 'credits')}.`,
  textsUse: (c) => `Texts use ${count(c)} ${one(c, 'credit', 'credits')}.`,
  after: (c) => `Credits after sending: ${count(c)}.`,
  smsWaits: (w) => `${count(w)} ${one(w, 'SMS message', 'SMS messages')} will wait for credits.`,
  quiet: (n, time) =>
    `Texts to ${count(n)} ${one(n, 'person', 'people')} wait until ${time}, their time.`,
  addCredits: 'Add credits',
  askOwner: 'Ask an owner',
  cancel: 'Cancel',
  allSent: '[Next: nothing. Everyone with a number has been sent a link.]',
  noMobile: (m) => `${m} ${one(m, 'has', 'have')} no mobile number.`,
  stoppedCount: (k) => `${k} ${one(k, 'has', 'have')} stopped texts.`,
  result: (r) =>
    [
      r.sending === 0 ? '' : `Sending to ${r.sending} ${one(r.sending, 'person', 'people')}.`,
      r.m === 0 ? '' : TW.noMobile(r.m),
      r.k === 0 ? '' : TW.stoppedCount(r.k),
      r.held === 0 ? '' : `${r.held} held: no credits.`,
      r.waits === 0
        ? ''
        : `${r.waits} ${one(r.waits, 'waits', 'wait')} until ${r.time}, their time.`,
    ].filter((line) => line !== ''),
};

const frCount = (n: number) => n.toLocaleString('fr-FR');

const TW_FR: TextWords = {
  text: '[Envoyer le lien par SMS]',
  bulk: (n) => `[Envoyer les liens par SMS à ${n}]`,
  sending: '[Envoi du SMS…]',
  held: '[SMS en attente : plus de crédits]',
  waits: (time) => `[SMS en attente jusqu’à ${time}, heure locale]`,
  notDelivered: (time) => `[SMS non distribué · ${time}]`,
  stopped: '[SMS refusés]',
  sendingTo: (name) => `[Envoi du lien à ${name}.]`,
  checkOne: (name) => `[Envoyer le lien par SMS à ${name} ?]`,
  checkMany: (n) => `[Envoyer les liens par SMS à ${n} ${one(n, 'personne', 'personnes')} ?]`,
  checkLine:
    '[Chacune reçoit un SMS avec son propre lien. Les liens envoyés avant continuent de fonctionner.]',
  thisTextUses: (c) => `[Ce SMS utilise ${frCount(c)} ${one(c, 'crédit', 'crédits')}.]`,
  textsUse: (c) => `[Les SMS utilisent ${frCount(c)} ${one(c, 'crédit', 'crédits')}.]`,
  after: (c) => `[Crédits après l’envoi : ${frCount(c)}.]`,
  smsWaits: (w) => `[${frCount(w)} SMS ${one(w, 'attendra', 'attendront')} des crédits.]`,
  quiet: (n, time) =>
    `[Les SMS à ${frCount(n)} ${one(n, 'personne', 'personnes')} attendent ${time}, heure locale.]`,
  addCredits: '[Ajouter des crédits]',
  askOwner: '[Demander à un propriétaire]',
  cancel: 'Annuler',
  allSent: '[Étape suivante : aucune. Toutes les personnes avec un numéro ont reçu un lien.]',
  noMobile: (m) => `[${m} ${one(m, 'n’a pas', 'n’ont pas')} de numéro de portable.]`,
  stoppedCount: (k) => `[${k} ${one(k, 'a refusé', 'ont refusé')} les SMS.]`,
  result: (r) =>
    [
      r.sending === 0 ? '' : `[Envoi à ${r.sending} ${one(r.sending, 'personne', 'personnes')}.]`,
      r.m === 0 ? '' : TW_FR.noMobile(r.m),
      r.k === 0 ? '' : TW_FR.stoppedCount(r.k),
      r.held === 0 ? '' : `[${r.held} en attente : plus de crédits.]`,
      r.waits === 0 ? '' : `[${r.waits} en attente jusqu’à ${r.time}, heure locale.]`,
    ].filter((line) => line !== ''),
};

export const TEXT_WORDS: Record<'en' | 'fr' | 'es' | 'pt', TextWords> = {
  en: TW,
  fr: TW_FR,
  es: TW,
  pt: TW,
};

/** A sample of sc-3928's unit costs: one text's credits by its number's country, never the event's. */
export const CREDITS_A_TEXT: Readonly<Record<string, number>> = {
  NG: 62,
  GB: 9,
  FR: 13,
  ES: 14,
  PT: 8,
  BR: 10,
  MX: 29,
  US: 2,
};

export const BALANCE = 1500;
export const QUIET_ENDS = '09:00';
export const SENT_MS = 2400;

export function creditsFor(country = 'NG'): number {
  return CREDITS_A_TEXT[country] ?? 0;
}

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

export function checkOf(due: number, others: readonly Entry[], t: Texting): Check {
  const afford = Math.min(due, Math.floor(t.credits / creditsFor()));
  const uses = afford * creditsFor();

  return {
    n: due,
    m: others.filter((one) => one.mobile == null && one.link === 'none').length,
    k: others.filter((one) => one.mobile != null && one.stopped === true).length,
    afford,
    uses,
    after: t.credits - uses,
    wait: due - afford,
  };
}

export function bulkCheck(entries: readonly Entry[], t: Texting): Check {
  return checkOf(entries.filter(owed).length, entries, t);
}

/** Pressed: each text sends, waits for credits, or waits for 09:00; the result counts each person in one line. */
export function textSome(
  entries: readonly Entry[],
  ids: readonly string[],
  t: Texting,
): { entries: Entry[]; credits: number; result: Result } {
  const afford = t.quiet ? 0 : Math.min(ids.length, Math.floor(t.credits / creditsFor()));
  const go = new Set(t.quiet ? [] : ids.slice(0, afford));
  const held = new Set(t.quiet ? [] : ids.slice(afford));
  const waits = new Set(t.quiet ? ids : []);
  const pending = (id: string): Entry['pending'] =>
    go.has(id) ? 'sending' : held.has(id) ? 'held' : waits.has(id) ? 'waits' : undefined;
  const all = ids.length > 1;

  return {
    entries: entries.map((one) => {
      const now = pending(one.id);
      return now == null ? one : { ...one, pending: now, undelivered: null };
    }),
    credits: t.credits - go.size * creditsFor(),
    result: {
      sending: go.size,
      m: all ? entries.filter((one) => one.mobile == null && one.link === 'none').length : 0,
      k: all ? entries.filter((one) => one.mobile != null && one.stopped === true).length : 0,
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
