import { countryChoices, currencyLabel, timezoneLabel } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { limitNotice, newOrganisationMessage } from '../../kit/organisationCreate.ts';
import { type Place, SW } from '../OrgSwitcherModel.ts';

/** The new words, for the linguist; the rest are main's, from en.json. */
export const WALK = {
  whatTitle: 'What’s it called?',
  whereTitle: 'Where is it based?',
  readyTitle: 'Ready to create it?',
  fromDevice: 'From this device',
  allCountries: 'All countries',
  discardTitle: 'Discard this organisation?',
  discardBody: 'Nothing is created, and what you entered is not kept.',
  discard: 'Discard',
  noneYet: 'None yet',
} as const;

export const CREATE_STATES = [
  'name',
  'typing',
  'name-blank',
  'name-long',
  'name-refused',
  'country',
  'country-list',
  'country-search',
  'country-picked',
  'country-none',
  'ready',
  'creating',
  'limited',
  'failed',
  'created',
  'back-name',
  'back-country',
  'discard',
] as const;

export type CreateState = (typeof CREATE_STATES)[number];

export function createStateOf(param: string | undefined): CreateState | null {
  return CREATE_STATES.find((state) => state === param) ?? null;
}

export type Step = 1 | 2 | 3;
export const STEPS = 3;

export type Sent = 'idle' | 'creating' | 'limited' | 'failed';

export interface Device {
  country: string | null;
  zone: string;
}

export const SAMPLE_DEVICE: Device = { country: 'PT', zone: 'Europe/Lisbon' };
export const SAMPLE_NAME = 'Lumen Feiras';
export const LONG_NAME =
  'Lumen Feiras, Congressos e Celebrações de Lisboa, do Porto e do Algarve para Empresas, Famílias, Escolas e Associações';
export const LIMIT_LIFTS = new Date(2026, 10, 3, 10, 41);
export const ROLE = 'Owner';

export interface Walk {
  step: Step;
  name: string;
  country: string | null;
  query: string;
  refusal: string | null;
  sent: Sent;
  asking: boolean;
  cameBack: boolean;
  device: Device;
}

export function freshWalk(device: Device): Walk {
  return {
    step: 1,
    name: '',
    country: device.country,
    query: '',
    refusal: null,
    sent: 'idle',
    asking: false,
    cameBack: false,
    device,
  };
}

export function walkFor(state: CreateState, t: TFunction, phone: boolean): Walk | null {
  const named = { ...freshWalk(SAMPLE_DEVICE), name: SAMPLE_NAME };
  const at = (step: Step, rest: Partial<Walk> = {}): Walk => ({ ...named, step, ...rest });

  switch (state) {
    case 'name':
      return freshWalk(SAMPLE_DEVICE);
    case 'typing':
      return named;
    case 'name-blank':
      return { ...freshWalk(SAMPLE_DEVICE), refusal: t('orgGeneral.nameBlank') };
    case 'name-long':
      return at(1, { name: LONG_NAME, refusal: newOrganisationMessage('name', LONG_NAME, t) });
    case 'name-refused':
      return at(1, { refusal: t('orgGeneral.nameBlank') });
    case 'country':
    case 'country-list':
      return at(2);
    case 'country-search':
      return at(2, { query: 'bra' });
    case 'country-picked':
      return at(2, { query: 'bra', country: 'BR' });
    case 'country-none':
      return at(2, {
        country: null,
        device: { ...SAMPLE_DEVICE, country: null },
        refusal: t('forms.countryBlank'),
      });
    case 'ready':
      return at(3);
    case 'creating':
      return at(3, { sent: 'creating' });
    case 'limited':
      return at(3, { sent: 'limited' });
    case 'failed':
      return at(3, { sent: 'failed' });
    case 'back-name':
      return at(1, { cameBack: true });
    case 'back-country':
      return at(2, { country: 'BR', cameBack: true });
    case 'discard':
      return at(phone ? 2 : 1, { asking: true });
    case 'created':
      return null;
  }
}

export function opensTyping(state: CreateState | null): boolean {
  return (
    state == null ||
    state === 'name' ||
    state === 'typing' ||
    state === 'name-blank' ||
    state === 'name-long' ||
    state === 'name-refused' ||
    state === 'country-search'
  );
}

/** Cancel asks first only when something was entered: a name, or a country other than the device's. */
export function entered(walk: Walk): boolean {
  return walk.name.trim() !== '' || walk.country !== walk.device.country;
}

export function stepRefusal(walk: Walk, t: TFunction): string | null {
  if (walk.step === 1) return newOrganisationMessage('name', walk.name, t);
  if (walk.step === 2) return newOrganisationMessage('countryCode', walk.country ?? '', t);

  return null;
}

export function forward(walk: Walk, t: TFunction): Walk {
  const refusal = stepRefusal(walk, t);
  if (refusal != null) return { ...walk, refusal };
  if (walk.step === 3) return walk;

  return { ...walk, step: walk.step === 1 ? 2 : 3, refusal: null, query: '', cameBack: false };
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

/** What Create answers: a lock that lifts at 10:41 still holds; anything else is created. */
export function answerTo(walk: Walk): 'created' | 'limited' {
  return walk.sent === 'limited' ? 'limited' : 'created';
}

export interface Country {
  code: string;
  name: string;
}

let named: readonly Country[] | null = null;

/** Every country in English, made once: naming all 249 is slow on a phone. */
export function countries(): readonly Country[] {
  named ??= countryChoices('en');

  return named;
}

/** Main's ListPicker narrowing: a case-insensitive "includes" on the trimmed search. */
export function search(choices: readonly Country[], query: string): readonly Country[] {
  const needle = query.trim().toLocaleLowerCase();
  if (needle === '') return choices;

  return choices.filter((choice) => choice.name.toLocaleLowerCase().includes(needle));
}

export function countryName(code: string | null): string | null {
  if (code == null) return null;

  return countries().find((country) => country.code === code)?.name ?? code;
}

// Regions::currencyOf on the API, 7 Nov 2026; Antarctica has none.
const API_CURRENCIES =
  'AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AQ: AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:EUR BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BQ:USD BR:BRL BS:BSD BT:BTN BV:NOK BW:BWP BY:BYN BZ:BZD CA:CAD CC:AUD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:XCG CX:AUD CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP EH:MAD ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR GQ:XAF GR:EUR GS:GBP GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HM:AUD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IO:USD IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:ZAR LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NF:AUD NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NU:NZD NZ:NZD OM:OMR PA:PAB PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PN:NZD PR:USD PS:ILS PT:EUR PW:USD PY:PYG QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SJ:NOK SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:XCG SY:SYP SZ:SZL TC:USD TD:XAF TF:EUR TG:XOF TH:THB TJ:TJS TK:NZD TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX UM:USD US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES VG:USD VI:USD VN:VND VU:VUV WF:XPF WS:WST YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:ZWG';

const CURRENCY_OF: ReadonlyMap<string, string> = new Map(
  API_CURRENCIES.split(' ').map((pair) => {
    const [country = '', currency = ''] = pair.split(':');

    return [country, currency];
  }),
);

export function sampleCurrency(country: string | null): string | null {
  if (country == null) return null;
  const currency = CURRENCY_OF.get(country);

  return currency == null || currency === '' ? null : currency;
}

export function currencyWords(country: string | null): { words: string; none: boolean } {
  const currency = sampleCurrency(country);

  return currency == null
    ? { words: WALK.noneYet, none: true }
    : { words: currencyLabel(currency, 'en'), none: false };
}

export function rowLabel(country: Country): string {
  return `${country.name}, ${currencyWords(country.code).words}`;
}

export interface Fact {
  key: 'country' | 'currency' | 'timezone' | 'contact';
  label: string;
  value: string;
  none: boolean;
}

export function factsOf(walk: Walk, email: string, t: TFunction, contact: boolean): Fact[] {
  const name = countryName(walk.country);
  const currency = currencyWords(walk.country);
  const facts: Fact[] =
    name == null
      ? []
      : [
          { key: 'country', label: t('createOrganisation.country'), value: name, none: false },
          {
            key: 'currency',
            label: t('orgGeneral.currency'),
            value: currency.words,
            none: currency.none,
          },
        ];
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

export function cardWords(walk: Walk, email: string, t: TFunction): string {
  const facts = factsOf(walk, email, t, true).map((fact) => `${fact.label}, ${fact.value}.`);

  return [`${walk.name.trim()}.`, `${SW.yourRole(ROLE)}.`, ...facts].join(' ');
}

export function boxWords(walk: Walk, t: TFunction): string {
  const fromDevice = WALK.fromDevice.charAt(0).toLocaleLowerCase() + WALK.fromDevice.slice(1);

  return `${t('orgGeneral.currency')}, ${currencyWords(walk.country).words}. ${t('orgGeneral.timezone')}, ${fromDevice}, ${timezoneLabel(walk.device.zone)}.`;
}

export function limitedWords(locale: string, t: TFunction): { title: string; body: string | null } {
  return limitNotice(LIMIT_LIFTS, locale, t);
}

export function cardNameSize(name: string): number {
  return name.trim().length >= 40 ? 18 : 24;
}

/** The demo's one new organisation, as the boards and the web draw it: its id is its colour, amber, whatever country is picked. */
export const NEW_ORG_ID = 'org-lumen-feiras-pt';

export function foundedPlace(walk: Walk): Place {
  return {
    id: NEW_ORG_ID,
    name: walk.name.trim(),
    role: ROLE,
    fresh: true,
  };
}

export const SAMPLE_FOUNDED: Place = foundedPlace({
  ...freshWalk(SAMPLE_DEVICE),
  name: SAMPLE_NAME,
});
