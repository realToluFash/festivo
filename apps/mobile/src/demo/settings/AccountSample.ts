import {
  callingCode,
  cleanCode,
  codeProblem,
  countryChoices,
  formatPhone,
  type ZoneRow,
} from '@soirely/domain';

import type { Contact } from '../../kit/accountPage.ts';
import { SAMPLE } from '../samples.ts';

export const SECOND_EMAIL = 'folake.adeyemi@gmail.com';

export const EMAILS: readonly Contact[] = [
  { id: 'email-1', shown: SAMPLE.email, verified: true, primary: true },
  { id: 'email-2', shown: SECOND_EMAIL, verified: false, primary: false },
];

export const PHONES: readonly Contact[] = [
  { id: 'phone-1', shown: SAMPLE.phoneShown, verified: true, primary: true },
];

export const PHONE_COUNTRY = 'GB';

/** A number in Ofcom's range kept for drama, so it reaches nobody. */
export const SECOND_PHONE = '+44 7700 900461';

export const HOME_ZONE: ZoneRow = {
  id: 'Africa/Lagos',
  city: 'Lagos',
  country: 'Nigeria',
  offset: '+01:00',
};

/** Offsets as they stand in November, daylight saving included where it is summer. */
export const ZONES: readonly ZoneRow[] = [
  { id: 'Africa/Abidjan', city: 'Abidjan', country: 'Côte d’Ivoire', offset: '+00:00' },
  { id: 'Africa/Accra', city: 'Accra', country: 'Ghana', offset: '+00:00' },
  { id: 'Europe/Berlin', city: 'Berlin', country: 'Germany', offset: '+01:00' },
  { id: 'America/Bogota', city: 'Bogotá', country: 'Colombia', offset: '-05:00' },
  {
    id: 'America/Argentina/Buenos_Aires',
    city: 'Buenos Aires',
    country: 'Argentina',
    offset: '-03:00',
  },
  { id: 'Africa/Dakar', city: 'Dakar', country: 'Senegal', offset: '+00:00' },
  { id: 'Asia/Dubai', city: 'Dubai', country: 'United Arab Emirates', offset: '+04:00' },
  { id: 'Africa/Johannesburg', city: 'Johannesburg', country: 'South Africa', offset: '+02:00' },
  { id: 'Africa/Kinshasa', city: 'Kinshasa', country: 'Congo - Kinshasa', offset: '+01:00' },
  {
    id: 'Asia/Kolkata',
    city: 'Kolkata',
    country: 'India',
    offset: '+05:30',
    aliases: ['Calcutta'],
    formerName: 'Calcutta',
  },
  HOME_ZONE,
  { id: 'Europe/Lisbon', city: 'Lisbon', country: 'Portugal', offset: '+00:00' },
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', offset: '+00:00' },
  { id: 'America/Los_Angeles', city: 'Los Angeles', country: 'United States', offset: '-08:00' },
  { id: 'Africa/Luanda', city: 'Luanda', country: 'Angola', offset: '+01:00' },
  { id: 'Europe/Madrid', city: 'Madrid', country: 'Spain', offset: '+01:00' },
  { id: 'Africa/Maputo', city: 'Maputo', country: 'Mozambique', offset: '+02:00' },
  { id: 'America/Mexico_City', city: 'Mexico City', country: 'Mexico', offset: '-06:00' },
  { id: 'Africa/Nairobi', city: 'Nairobi', country: 'Kenya', offset: '+03:00' },
  { id: 'America/New_York', city: 'New York', country: 'United States', offset: '-05:00' },
  { id: 'Europe/Paris', city: 'Paris', country: 'France', offset: '+01:00' },
  { id: 'Europe/San_Marino', city: 'San Marino', country: 'San Marino', offset: '+01:00' },
  { id: 'America/El_Salvador', city: 'San Salvador', country: 'El Salvador', offset: '-06:00' },
  { id: 'America/Santarem', city: 'Santarém', country: 'Brazil', offset: '-03:00' },
  { id: 'America/Santiago', city: 'Santiago', country: 'Chile', offset: '-03:00' },
  {
    id: 'America/Santo_Domingo',
    city: 'Santo Domingo',
    country: 'Dominican Republic',
    offset: '-04:00',
  },
  { id: 'America/Sao_Paulo', city: 'São Paulo', country: 'Brazil', offset: '-03:00' },
  { id: 'Australia/Sydney', city: 'Sydney', country: 'Australia', offset: '+11:00' },
  { id: 'Asia/Tokyo', city: 'Tokyo', country: 'Japan', offset: '+09:00' },
  { id: 'America/Toronto', city: 'Toronto', country: 'Canada', offset: '-05:00' },
];

/** The emailed, texted or WhatsApp code: only the demo's own passes. */
export function sentCodeProblem(typed: string): 'blank' | 'short' | 'wrong' | null {
  const problem = codeProblem(typed);
  if (problem != null) return problem;

  return cleanCode(typed) === SAMPLE.code ? null : 'wrong';
}

/** The authenticator app's code as setup checks it: no recovery code yet. */
export function authenticatorProblem(typed: string): 'blank' | 'short' | 'wrong' | null {
  const problem = codeProblem(typed);
  if (problem != null) return problem;

  return cleanCode(typed) === SAMPLE.authenticator ? null : 'wrong';
}

/** A second factor once two-factor is on: the app's code or a recovery code. */
export function secondFactorProblem(typed: string): 'blank' | 'wrong' | null {
  const code = cleanCode(typed).toLowerCase();
  if (code === '') return 'blank';

  return code === SAMPLE.authenticator || code === SAMPLE.recovery ? null : 'wrong';
}

export function passwordProblem(typed: string): 'blank' | 'wrong' | null {
  if (typed === '') return 'blank';

  return typed === SAMPLE.password ? null : 'wrong';
}

export function phoneShown(country: string, typed: string): string {
  const code = callingCode(country) ?? '';

  return formatPhone(`${code}${typed.replace(/\D/gu, '')}`);
}

export function countryName(country: string): string {
  return countryChoices('en').find((choice) => choice.code === country)?.name ?? country;
}

export function plural(count: number, one: string, other: string): string {
  return count === 1 ? one : other;
}
