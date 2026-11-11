import {
  type FoundingCurrencies,
  type NewOrganisationAnswer,
  countryChoices,
  foundingCurrencyWords,
  newOrganisationRefusal,
  timezoneLabel,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { type Turned, phoneOnItsSide } from './keyboard';

export type Step = 1 | 2 | 3;
export const STEPS = 3;

export type Sent = 'idle' | 'creating' | 'limited' | 'failed';

export interface Device {
  country: string | null;
  zone: string;
}

export interface Walk {
  step: Step;
  name: string;
  country: string | null;
  query: string;
  refusal: string | null;
  sent: Sent;
  lifts: Date | null;
  asking: boolean;
  cameBack: boolean;
  device: Device;
  /** sc-563: the address is managed by its home organisation, so the first step is the refusal. */
  managed: boolean;
}

export function freshWalk(device: Device): Walk {
  return {
    step: 1,
    name: '',
    country: device.country,
    query: '',
    refusal: null,
    sent: 'idle',
    lifts: null,
    asking: false,
    cameBack: false,
    device,
    managed: false,
  };
}

export function stepRefusal(walk: Walk, t: TFunction): string | null {
  if (walk.step === 1) return newOrganisationRefusal('name', walk.name, t);
  if (walk.step === 2) return newOrganisationRefusal('countryCode', walk.country ?? '', t);

  return null;
}

export function forward(walk: Walk, t: TFunction): Walk {
  const refusal = stepRefusal(walk, t);
  if (refusal != null) return { ...walk, refusal };
  if (walk.step === 3) return walk;

  return { ...walk, step: walk.step === 1 ? 2 : 3, refusal: null, query: '', cameBack: false };
}

/** The step on screen and the one leaving it; each turn has its own number, so the two never share a key. */
export interface WalkTurn {
  walk: Walk;
  turn: number;
  leaving: Walk | null;
  dir: 1 | -1;
}

export function firstTurn(walk: Walk): WalkTurn {
  return { walk, turn: 0, leaving: null, dir: 1 };
}

/** A walk at the same step replaces it in place; another step is a new turn, with the one on screen leaving. */
export function turnTo(now: WalkTurn, next: Walk): WalkTurn {
  if (next.step === now.walk.step) return { ...now, walk: next };

  return {
    walk: next,
    turn: now.turn + 1,
    leaving: now.walk,
    dir: next.step > now.walk.step ? 1 : -1,
  };
}

export function turnEnded(now: WalkTurn, turn: number): WalkTurn {
  return now.turn === turn && now.leaving != null ? { ...now, leaving: null } : now;
}

/** Back keeps everything: the name as typed, the country as picked; only the search clears. */
export function back(walk: Walk): Walk {
  if (walk.step === 1) return walk;

  return {
    ...walk,
    step: walk.step === 3 ? 2 : 1,
    refusal: null,
    query: '',
    sent: 'idle',
    cameBack: true,
  };
}

export function typed(walk: Walk, name: string): Walk {
  return { ...walk, name, refusal: null };
}

export function picked(walk: Walk, country: string): Walk {
  return { ...walk, country, refusal: null };
}

export type WalkAnswer<Made> = NewOrganisationAnswer<Made>;

/** The walk after an answer other than created: a refused field takes the walk back to its step, with the server's reason. */
export function answered(
  walk: Walk,
  answer: Exclude<WalkAnswer<unknown>, { kind: 'created' }>,
): Walk {
  if (answer.kind === 'limited') return { ...walk, sent: 'limited', lifts: answer.until };
  if (answer.kind === 'failed') return { ...walk, sent: 'failed' };

  const name = answer.errors.name;

  return {
    ...back(name != null ? { ...walk, step: 2 } : walk),
    refusal: name ?? answer.errors.countryCode ?? null,
  };
}

export interface Country {
  code: string;
  name: string;
}

const named = new Map<string, readonly Country[]>();

/** Every country in the reader's language, made once: naming all 249 is slow on a phone. */
export function countries(locale: string): readonly Country[] {
  const known = named.get(locale);
  if (known != null) return known;
  const made = countryChoices(locale);
  named.set(locale, made);

  return made;
}

export function countryName(code: string | null, locale: string): string | null {
  if (code == null) return null;

  return countries(locale).find((country) => country.code === code)?.name ?? code;
}

export type Currencies = FoundingCurrencies;

export interface Naming {
  locale: string;
  currencies: Currencies | null;
}

export function rowLabel(country: Country, naming: Naming, t: TFunction): string {
  const currency = foundingCurrencyWords(country.code, naming.currencies, naming.locale, t);

  return currency == null ? country.name : `${country.name}, ${currency.words}`;
}

export interface Fact {
  key: 'country' | 'currency' | 'timezone' | 'contact';
  label: string;
  value: string;
  none: boolean;
}

export function factsOf(
  walk: Walk,
  email: string,
  t: TFunction,
  contact: boolean,
  naming: Naming,
): Fact[] {
  const name = countryName(walk.country, naming.locale);
  const currency = foundingCurrencyWords(walk.country, naming.currencies, naming.locale, t);
  const facts: Fact[] = [];
  if (name != null) {
    facts.push({
      key: 'country',
      label: t('createOrganisation.country'),
      value: name,
      none: false,
    });
    if (currency != null)
      facts.push({
        key: 'currency',
        label: t('orgGeneral.currency'),
        value: currency.words,
        none: currency.none,
      });
  }
  if (name != null || contact)
    facts.push({
      key: 'timezone',
      label: t('orgGeneral.timezone'),
      value: timezoneLabel(walk.device.zone),
      none: false,
    });
  if (contact)
    facts.push({ key: 'contact', label: t('orgGeneral.contact'), value: email, none: false });

  return facts;
}

export function cardWords(walk: Walk, email: string, t: TFunction, naming: Naming): string {
  const facts = factsOf(walk, email, t, true, naming).map(
    (fact) => `${fact.label}, ${fact.value}.`,
  );

  return [
    `${walk.name.trim()}.`,
    `${t('switcher.yourRole', { role: t('roles.owner') })}.`,
    ...facts,
  ].join(' ');
}

export function boxWords(walk: Walk, t: TFunction, naming: Naming): string {
  const fromDevice = t('createOrganisation.fromDevice');
  const lowered = fromDevice.charAt(0).toLocaleLowerCase(naming.locale) + fromDevice.slice(1);
  const currency = foundingCurrencyWords(walk.country, naming.currencies, naming.locale, t);
  const zone = `${t('orgGeneral.timezone')}, ${lowered}, ${timezoneLabel(walk.device.zone)}.`;

  return currency == null ? zone : `${t('orgGeneral.currency')}, ${currency.words}. ${zone}`;
}

export function cardNameSize(name: string): number {
  return name.trim().length >= 40 ? 18 : 24;
}

/** A phone on its side with the keys up: the strip above them is too short for the upright arrangement (sc-35256, sc-38666). */
export function onItsSideTyping({ keysUp, ...screen }: Turned & { keysUp: boolean }): boolean {
  return keysUp && phoneOnItsSide(screen);
}

/** Where Continue sits: pinned under the step, or, on a phone on its side with the keys up, where too little is left above them for a pinned foot and the field, scrolled as the step's last part, and on the country step left out until the keys go down, so it is not below the whole list (sc-35256). */
export function footPlace({
  step,
  ...screen
}: {
  phone: boolean;
  width: number;
  height: number;
  keysUp: boolean;
  step: Step;
}): 'pinned' | 'scrolls' | 'hidden' {
  if (!onItsSideTyping(screen)) return 'pinned';

  return step === 2 ? 'hidden' : 'scrolls';
}

/** The walk's nav under the status bar: shorter on a phone on its side with the keys up, as both platforms shorten theirs, never under the 44 touch floor (sc-38666). */
export function walkNav(sideways: boolean): number {
  return sideways ? 44 : 52;
}

export const NAME_LABEL = 14;

export function nameField(large: boolean): number {
  return large ? 72 : 52;
}

export function nameGap(large: boolean): number {
  return large ? 8 : 7;
}

/** Organisation name's label and field: the label beside the field on a phone on its side with the keys up, so the row is the field's height; above it everywhere else, and at the accessibility sizes, where the field comes first (sc-38666). */
export function nameRow({ sideways, large }: { sideways: boolean; large: boolean }): {
  beside: boolean;
  height: number;
} {
  const field = nameField(large);
  if (sideways && !large) return { beside: true, height: field };

  return { beside: false, height: NAME_LABEL * 1.3 + nameGap(large) + field };
}

export interface NameInSight {
  /** The step's scroll view height, down to the keys while they are up. */
  viewport: number;
  /** The name group's top, its label's, inside the scroll content. */
  top: number;
  /** The field's bottom inside the name group. */
  fieldEnd: number;
  /** The group's bottom, under its help or reason, inside the scroll content. */
  bottom: number;
  margin: number;
}

/** The scroll that brings the name group's help or reason above the keys, never past the margin above the label, nor past the field where the label and field do not both fit; null when it needs none (sc-38666). */
export function nameInSight({
  viewport,
  top,
  fieldEnd,
  bottom,
  margin,
}: NameInSight): number | null {
  const over = bottom + margin - viewport;
  if (viewport <= 0 || over <= 0) return null;

  return Math.max(0, Math.min(over, Math.max(top - margin, top + fieldEnd + margin - viewport)));
}
