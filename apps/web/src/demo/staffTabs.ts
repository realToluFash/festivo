import en from '../i18n/locales/en.json';
import es from '../i18n/locales/es.json';
import fr from '../i18n/locales/fr.json';
import pt from '../i18n/locales/pt.json';
import type { DemoLink } from './settings.ts';

export type StaffLang = 'en' | 'fr' | 'es' | 'pt';

const LANG_OF: Record<string, StaffLang> = {
  'en-GB': 'en',
  'en-US': 'en',
  'fr-FR': 'fr',
  'es-ES': 'es',
  'pt-BR': 'pt',
};

const LOCALE_OF: Record<StaffLang, string | null> = {
  en: null,
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-BR',
};

const BY_LANG = { en, fr, es, pt } as const;

/** The language a Staff page's ?locale= asks for, or null when it names none the demo has (sc-99786). */
export function staffLangOf(locale: string | null): StaffLang | null {
  return locale == null ? null : (LANG_OF[locale] ?? null);
}

/** The query that keeps a language when a tab opens another Staff page. */
export function staffQuery(lang: StaffLang): string {
  const locale = LOCALE_OF[lang];

  return locale == null ? '' : `?locale=${locale}`;
}

/** The product's own tab words and the row's name, in SW.tabs' order. */
export function staffTabWords(lang: StaffLang): { title: string; tabs: readonly string[] } {
  const L = BY_LANG[lang];

  return {
    title: L.roster.title,
    tabs: [L.roster.roster, L.jobs.tab, L.stations.tab, L.hours.tab],
  };
}

const STAFF = '/demo/events/evt-wed-4/staff';

/** The demo's home lists the tab row's states (sc-99786): each page in each language, and the Roster with details docked. */
export const STAFF_TAB_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The tabs on each Staff page, at 641, 800, 960 and 1280 × 800 and at 400% zoom',
    states: [
      { to: `${STAFF}/roster`, name: 'Roster, in English' },
      { to: `${STAFF}/roster?locale=fr-FR`, name: 'Roster, in French' },
      { to: `${STAFF}/jobs`, name: 'Jobs and shifts, in English' },
      { to: `${STAFF}/jobs?locale=fr-FR`, name: 'Jobs and shifts, in French' },
      { to: `${STAFF}/stations`, name: 'Stations, in English' },
      { to: `${STAFF}/stations?locale=fr-FR`, name: 'Stations, in French' },
      { to: `${STAFF}/hours`, name: 'Hours worked, in English' },
      { to: `${STAFF}/hours?locale=fr-FR`, name: 'Hours worked, in French' },
    ],
  },
  {
    name: 'Spanish and Portuguese at 641 × 800, and the Roster with details docked',
    states: [
      { to: `${STAFF}/roster?locale=es-ES`, name: 'Roster, in Spanish' },
      { to: `${STAFF}/roster?locale=pt-BR`, name: 'Roster, in Portuguese' },
      { to: `${STAFF}/jobs?locale=es-ES`, name: 'Jobs and shifts, in Spanish' },
      { to: `${STAFF}/jobs?locale=pt-BR`, name: 'Jobs and shifts, in Portuguese' },
      { to: `${STAFF}/stations?locale=es-ES`, name: 'Stations, in Spanish' },
      { to: `${STAFF}/stations?locale=pt-BR`, name: 'Stations, in Portuguese' },
      { to: `${STAFF}/hours?locale=es-ES`, name: 'Hours worked, in Spanish' },
      { to: `${STAFF}/hours?locale=pt-BR`, name: 'Hours worked, in Portuguese' },
      { to: `${STAFF}/roster?state=details`, name: 'Roster, details docked, in English' },
      { to: `${STAFF}/roster?state=detailsFrench`, name: 'Roster, details docked, in French' },
    ],
  },
];
