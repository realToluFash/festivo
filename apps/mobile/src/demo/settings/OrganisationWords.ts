import { SAMPLE } from '../samples.ts';

const ORG = SAMPLE.organisation;

/** en.json's words for Settings › Organisation, with Ire Events filled in. */
export const DETAILS_WORDS = {
  title: 'Organisation',
  saved: `Saved. Everyone in ${ORG} sees the new details on their next screen.`,
  readOnly: (role: string) =>
    `Your role, ${role}, can see these but not change them. Owners and admins can.`,
} as const;

export const LANGUAGE_NAMES: Record<string, string> = {
  'languageNames.en': 'English',
  'languageNames.es': 'Spanish',
  'languageNames.fr': 'French',
  'languageNames.pt': 'Portuguese',
};

/** The app's `languageNamesInSentence.*` (en.json): a language named inside a sentence. */
export const LANGUAGE_NAMES_IN_SENTENCE: Record<string, string> = {
  'languageNamesInSentence.en': 'English',
  'languageNamesInSentence.es': 'Spanish',
  'languageNamesInSentence.fr': 'French',
  'languageNamesInSentence.pt': 'Portuguese',
};

/** Both keys as the app's fr.json has them, for a French reader: on its own capitalised, in a sentence not. */
export const LANGUAGE_NAMES_FR: Record<string, string> = {
  'languageNames.en': 'Anglais',
  'languageNames.es': 'Espagnol',
  'languageNames.fr': 'Français',
  'languageNames.pt': 'Portugais',
  'languageNamesInSentence.en': 'anglais',
  'languageNamesInSentence.es': 'espagnol',
  'languageNamesInSentence.fr': 'français',
  'languageNamesInSentence.pt': 'portugais',
};

export const DOMAIN_WORDS = {
  full: (most: number) =>
    `That is ${most} domains, the most the list can hold. Remove one to add another.`,
  blank: (example: string) => `Enter a domain, like ${example}.`,
  shape: (example: string) => `Enter a domain with a dot and no spaces, like ${example}.`,
  listed: (domain: string) => `${domain} is already on the list.`,
  publicDomain: 'You cannot use a public email domain.',
  notYours: 'Add a domain your own address is at.',
  removed: (domain: string) => `${domain} removed.`,
} as const;

export const OWNERSHIP_WORDS = {
  passwordWrong: 'That is not your password. Nothing was changed. Try again, or reset it by email.',
  leave: `Leave ${ORG}`,
  leaveOpener: `Leave ${ORG}…`,
  leaveTitle: `Leave ${ORG}?`,
  leaveBody: `You lose access to ${ORG} as soon as you leave.`,
  stay: 'Stay',
} as const;
