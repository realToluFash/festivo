import { SAMPLE } from '../samples.ts';

const ORG = SAMPLE.organisation;

export const OFF = 'Off';

/** en.json's words for Settings › Organisation, with Ire Events filled in; B splits a few of them in two. */
export const DETAILS_WORDS = {
  title: 'Organisation',
  details: 'Details',
  edit: 'Edit details',
  editTitle: 'Organisation details',
  name: 'Name',
  country: 'Country',
  contact: 'Contact address',
  currency: 'Currency',
  timezone: 'Time zone',
  language: 'Language for invitations',
  defaults: 'Defaults for new events',
  invitations: 'Invitations',
  searchCountry: 'Search countries',
  searchCurrency: 'Search currencies',
  searchTimezone: 'Search time zones',
  searchLanguage: 'Search languages',
  defaultsNote:
    'Currency and time zone: new events start with these. Events you already have keep theirs.',
  languageHint:
    'Invitation emails to people without a Soirely account are written in this language. People who already have an account get theirs in their own language.',
  save: 'Save',
  saving: 'Saving…',
  savedSays: 'Saved',
  saved: `Saved. Everyone in ${ORG} sees the new details on their next screen.`,
  savedLanguage: (language: string) =>
    `Saved. Invitation emails to people without a Soirely account go out in ${language} from now on. Invitations already sent are not sent again.`,
  discardLine: `${ORG} stays as it was.`,
  keepEditing: 'Keep editing',
  discard: 'Discard',
  nameBlank: "Enter the organisation's name.",
  currencyBlank: 'Choose a currency.',
  currencyPlaceholder: 'Choose a currency',
  contactBlank: 'Enter a contact email address.',
  contactInvalid: 'That does not look like an email address. Check it has an @ and a domain.',
  currencyRetired: (code: string) => `${code} (no longer in use)`,
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

const ADDED_NEXT = 'People whose main email address is at it can now ask to join.';

export const DOMAIN_WORDS = {
  title: 'Company domain joining',
  lead: `People whose main email address is at a domain on this list can ask to join ${ORG} when they sign up. Somebody who can manage members answers each one.`,
  offUntil: 'It is off until you add a domain.',
  working: 'People at it can ask to join',
  remove: 'Remove…',
  removeLabel: (domain: string) => `Remove ${domain}`,
  removeTitle: (domain: string) => `Remove ${domain}?`,
  removeBody: (domain: string) => `People at ${domain} can no longer ask to join this way.`,
  keep: 'Keep it',
  confirmRemove: 'Remove',
  add: 'Add domain',
  addTitle: 'Add a domain',
  addVerb: 'Add',
  field: 'Domain',
  help: (email: string, most: number) =>
    `Only a domain your own address is at. Yours is ${email}. Up to ${most} domains.`,
  full: (most: number) =>
    `That is ${most} domains, the most the list can hold. Remove one to add another.`,
  blank: (example: string) => `Enter a domain, like ${example}.`,
  shape: (example: string) => `Enter a domain with a dot and no spaces, like ${example}.`,
  listed: (domain: string) => `${domain} is already on the list.`,
  publicDomain: 'You cannot use a public email domain.',
  notYours: 'Add a domain your own address is at.',
  added: `Added. ${ADDED_NEXT}`,
  removed: (domain: string) => `${domain} removed.`,
} as const;

export const LINK_WORDS = {
  title: 'Requests to join',
  lead: `Anybody with this link can ask to join ${ORG}. Somebody who can manage members answers each request.`,
  linkLabel: 'Request link',
  copy: 'Copy link',
  help: 'Share it with the people you want to hear from. There is no list of organisations to find you in.',
  replace: 'Replace link…',
  replaceTitle: 'Replace the link?',
  replaceBody: 'This link stops working as soon as you replace it.',
  replaceConfirm: 'Replace link',
  keep: 'Keep it',
  on: 'The request link is on.',
  off: 'The request link is off. It will not work again: turning it on makes a new one.',
  replaced: 'The link is replaced. The old one no longer works.',
  copied: 'Link copied.',
  unreadable: 'The request link could not be loaded.',
} as const;

export const OWNERSHIP_WORDS = {
  title: 'Ownership and leaving',
  transfer: 'Transfer ownership',
  transferVerb: 'Transfer',
  transferNote: `Hand ${ORG} to another member. Asks for your password first.`,
  transferBody: `The new owner can change billing, members, roles and these settings, and can delete ${ORG}. You become an Admin.`,
  newOwner: 'New owner',
  ownerBlank: 'Choose who becomes the owner.',
  password: 'Your password',
  passwordBlank: 'Enter your password.',
  passwordWrong: 'That is not your password. Nothing was changed. Try again, or reset it by email.',
  passwordWhy: `So that nobody who picks up this device can give ${ORG} away.`,
  bothEmailed: (name: string) => `You and ${name} each get an email saying it happened.`,
  theNewOwner: 'the new owner',
  transferred: (name: string) => `${name} is now the owner`,
  transferredLine: 'You are an Admin. You both have an email saying so.',
  leave: `Leave ${ORG}`,
  leaveOpener: `Leave ${ORG}…`,
  leaveNote: `You lose access to its events. Everything you made stays with ${ORG}.`,
  leaveTitle: `Leave ${ORG}?`,
  leaveBody: `You lose access to ${ORG} as soon as you leave.`,
  stay: 'Stay',
  onlyOwnerTitle: 'You are the only owner',
  onlyOwnerBody: 'Make somebody else an owner, then you can leave.',
  deleteOpener: 'Delete organisation…',
  deleteNote: 'Deletes every event, guest and member record in it.',
  deleteTitle: `Delete ${ORG}`,
  deleteVerb: 'Delete',
  deleteWarningTitle: 'Everything in it goes',
  deleteWindow: (deadline: string) =>
    `This deletes it for everybody now. Soirely support can restore it until ${deadline}; after that it is gone for good.`,
  deleteType: `Type ${ORG} to confirm`,
  deleteMismatch: `Type ${ORG} exactly as shown to delete it.`,
  deleteMatches: 'That matches.',
  deleteExactly: 'Exactly as it is written, accents included.',
} as const;

export const TRY_AGAIN = 'Try again';
export const LOADING = 'Loading…';
