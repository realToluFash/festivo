import type { PausedOrganisation } from '@soirely/api-client';

import { YOU } from './sample.ts';

/** The suspension's two instants as the API writes them for each language (UserMailer::deadline), so Spanish copy carries no English date. */
const ENGLISH = { since: 'Monday, Nov 2 at 10:00 WAT', removesAt: 'Wednesday, Dec 2 at 10:00 WAT' };

const WRITTEN: Partial<Record<string, typeof ENGLISH>> = {
  en: ENGLISH,
  es: { since: 'lunes, 2 nov a las 10:00 WAT', removesAt: 'miércoles, 2 dic a las 10:00 WAT' },
  fr: { since: 'lundi 2 nov. à 10:00 WAT', removesAt: 'mercredi 2 déc. à 10:00 WAT' },
  pt: {
    since: 'segunda-feira, 2 de nov. às 10:00 WAT',
    removesAt: 'quarta-feira, 2 de dez. às 10:00 WAT',
  },
};

export function pausedIn(language: string): PausedOrganisation {
  const written = WRITTEN[language] ?? ENGLISH;

  return {
    id: 'org-ire-events',
    name: YOU.organisation,
    countryCode: 'NG',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    contactAddress: 'hello@ire.events',
    locale: 'en',
    plan: 'free',
    subscription: { status: 'active', periodEnd: null },
    suspension: {
      reason: 'domain_closed',
      domain: 'ire.events',
      since: { at: '2026-11-02T09:00:00Z', written: written.since },
      removesAt: { at: '2026-12-02T09:00:00Z', written: written.removesAt },
      onlyOwner: false,
    },
    ownerClaim: null,
  };
}
