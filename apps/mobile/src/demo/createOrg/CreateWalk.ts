import type { TFunction } from 'i18next';

import {
  type Currencies,
  type Device,
  type Step,
  type Walk,
  type WalkAnswer,
  freshWalk,
} from '../../kit/createWalk.ts';
import { newOrganisationMessage } from '../../kit/organisationCreate.ts';
import type { Place } from '../OrgSwitcherModel.ts';

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
  'managed',
] as const;

export type CreateState = (typeof CREATE_STATES)[number];

export function createStateOf(param: string | undefined): CreateState | null {
  return CREATE_STATES.find((state) => state === param) ?? null;
}

export const SAMPLE_DEVICE: Device = { country: 'PT', zone: 'Europe/Lisbon' };
export const SAMPLE_NAME = 'Lumen Feiras';
export const LONG_NAME =
  'Lumen Feiras, Congressos e Celebrações de Lisboa, do Porto e do Algarve para Empresas, Famílias, Escolas e Associações';
export const LIMIT_LIFTS = new Date(2026, 10, 3, 10, 41);

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
      return at(3, { sent: 'limited', lifts: LIMIT_LIFTS });
    case 'failed':
      return at(3, { sent: 'failed' });
    case 'back-name':
      return at(1, { cameBack: true });
    case 'back-country':
      return at(2, { country: 'BR', cameBack: true });
    case 'discard':
      return at(phone ? 2 : 1, { asking: true });
    case 'managed':
      return { ...freshWalk(SAMPLE_DEVICE), managed: true };
    case 'created':
      return null;
  }
}

/** Where focus goes as the walk opens in a state: the name, the search, or the question. */
export function focusOf(state: CreateState | null, walk: Walk): 'name' | 'search' | 'question' {
  if (state === 'country-search') return 'search';
  const typing =
    state == null ||
    state === 'name' ||
    state === 'typing' ||
    state === 'name-blank' ||
    state === 'name-long' ||
    state === 'name-refused';

  return walk.step === 1 && typing ? 'name' : 'question';
}

/** What Create answers: a lock that lifts at 10:41 still holds; anything else is created. */
export function answerTo(walk: Walk): WalkAnswer<Walk> {
  return walk.sent === 'limited'
    ? { kind: 'limited', until: LIMIT_LIFTS }
    : { kind: 'created', made: walk };
}

// Regions::currencyOf on the API, 7 Nov 2026; Antarctica has none.
const API_CURRENCIES =
  'AD:EUR AE:AED AF:AFN AG:XCD AI:XCD AL:ALL AM:AMD AO:AOA AQ: AR:ARS AS:USD AT:EUR AU:AUD AW:AWG AX:EUR AZ:AZN BA:BAM BB:BBD BD:BDT BE:EUR BF:XOF BG:EUR BH:BHD BI:BIF BJ:XOF BL:EUR BM:BMD BN:BND BO:BOB BQ:USD BR:BRL BS:BSD BT:BTN BV:NOK BW:BWP BY:BYN BZ:BZD CA:CAD CC:AUD CD:CDF CF:XAF CG:XAF CH:CHF CI:XOF CK:NZD CL:CLP CM:XAF CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CW:XCG CX:AUD CY:EUR CZ:CZK DE:EUR DJ:DJF DK:DKK DM:XCD DO:DOP DZ:DZD EC:USD EE:EUR EG:EGP EH:MAD ER:ERN ES:EUR ET:ETB FI:EUR FJ:FJD FK:FKP FM:USD FO:DKK FR:EUR GA:XAF GB:GBP GD:XCD GE:GEL GF:EUR GG:GBP GH:GHS GI:GIP GL:DKK GM:GMD GN:GNF GP:EUR GQ:XAF GR:EUR GS:GBP GT:GTQ GU:USD GW:XOF GY:GYD HK:HKD HM:AUD HN:HNL HR:EUR HT:HTG HU:HUF ID:IDR IE:EUR IL:ILS IM:GBP IN:INR IO:USD IQ:IQD IR:IRR IS:ISK IT:EUR JE:GBP JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KI:AUD KM:KMF KN:XCD KP:KPW KR:KRW KW:KWD KY:KYD KZ:KZT LA:LAK LB:LBP LC:XCD LI:CHF LK:LKR LR:LRD LS:ZAR LT:EUR LU:EUR LV:EUR LY:LYD MA:MAD MC:EUR MD:MDL ME:EUR MF:EUR MG:MGA MH:USD MK:MKD ML:XOF MM:MMK MN:MNT MO:MOP MP:USD MQ:EUR MR:MRU MS:XCD MT:EUR MU:MUR MV:MVR MW:MWK MX:MXN MY:MYR MZ:MZN NA:NAD NC:XPF NE:XOF NF:AUD NG:NGN NI:NIO NL:EUR NO:NOK NP:NPR NR:AUD NU:NZD NZ:NZD OM:OMR PA:PAB PE:PEN PF:XPF PG:PGK PH:PHP PK:PKR PL:PLN PM:EUR PN:NZD PR:USD PS:ILS PT:EUR PW:USD PY:PYG QA:QAR RE:EUR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SH:SHP SI:EUR SJ:NOK SK:EUR SL:SLE SM:EUR SN:XOF SO:SOS SR:SRD SS:SSP ST:STN SV:USD SX:XCG SY:SYP SZ:SZL TC:USD TD:XAF TF:EUR TG:XOF TH:THB TJ:TJS TK:NZD TL:USD TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TV:AUD TW:TWD TZ:TZS UA:UAH UG:UGX UM:USD US:USD UY:UYU UZ:UZS VA:EUR VC:XCD VE:VES VG:USD VI:USD VN:VND VU:VUV WF:XPF WS:WST YE:YER YT:EUR ZA:ZAR ZM:ZMW ZW:ZWG';

/** The sample's answer to /api/countries. */
export const SAMPLE_CURRENCIES: Currencies = new Map(
  API_CURRENCIES.split(' ').map((pair): [string, string | null] => {
    const [country = '', currency = ''] = pair.split(':');

    return [country, currency === '' ? null : currency];
  }),
);

/** The demo's one new organisation, as the boards and the web draw it: its id is its colour, amber, whatever country is picked. */
export const NEW_ORG_ID = 'org-lumen-feiras-pt';

export function foundedPlace(walk: Walk): Place {
  return {
    id: NEW_ORG_ID,
    name: walk.name.trim(),
    role: 'Owner',
    fresh: true,
  };
}

export const SAMPLE_FOUNDED: Place = foundedPlace({
  ...freshWalk(SAMPLE_DEVICE),
  name: SAMPLE_NAME,
});
