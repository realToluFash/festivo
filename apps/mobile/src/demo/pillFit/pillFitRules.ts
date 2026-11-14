export type PillFitLanguage = 'en' | 'fr' | 'es' | 'pt';

export const LANGUAGES: readonly { key: PillFitLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'fr', label: 'French' },
  { key: 'es', label: 'Spanish' },
  { key: 'pt', label: 'Portuguese' },
];

export const ORGANISATIONS = [
  { key: 'qa', label: 'QA Organisation' },
  { key: 'long', label: 'Internationalisation' },
] as const;

export type PillFitOrganisation = (typeof ORGANISATIONS)[number]['key'];

export function languageOf(name: string | undefined): PillFitLanguage {
  return LANGUAGES.find((language) => language.key === name)?.key ?? 'en';
}

export function organisationOf(name: string | undefined): PillFitOrganisation {
  return ORGANISATIONS.find((organisation) => organisation.key === name)?.key ?? 'qa';
}

export type Sending = 'accept' | 'decline' | null;

export function sendingOf(name: string | undefined): Sending {
  return name === 'accept' || name === 'decline' ? name : null;
}

export function waitingOf(count: string | undefined): 0 | 1 | 2 {
  return count === '0' ? 0 : count === '2' ? 2 : 1;
}

export function largestOf(size: string | undefined): boolean {
  return size === 'largest';
}
