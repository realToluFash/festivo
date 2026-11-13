import type { Category } from './vendors.ts';

export const CATEGORY_WORDS: Record<Category, string> = {
  catering: 'Catering',
  venue: 'Venue',
  flowers: 'Flowers',
  photography: 'Photography',
  music: 'Music',
  transport: 'Transport',
  staffing: 'Staffing',
  hire: 'Hire',
  other: 'Other',
};

/** Settings › Vendors' words, the English of Budget-A-Vendors and sc-82, kept in the demo: the developer adds the four locales when building the product's screen. */
export const VW = {
  title: 'Vendors',
  vendors: (count: number) => (count === 1 ? '1 vendor' : `${count} vendors`),
  inUseCount: (count: number) => `${count} in use`,
  archivedCount: (count: number) => `${count} archived`,
  cardLine: (organisation: string) =>
    `The people ${organisation} buys from, chosen on each event’s quotes.`,
  noneYet: 'No vendors yet',
  noneYetLine: (organisation: string) =>
    `Add the caterers, florists and venues ${organisation} buys from, once, and choose them on any event’s quote.`,
  add: 'Add a vendor',

  search: 'Search vendors',
  clearSearch: 'Clear the search',
  allCategories: 'All categories',
  inUse: 'In use',
  archived: 'Archived',
  noMatch: (typed: string, category: string | null) =>
    `No vendor matches “${typed}”${category == null ? '' : ` in ${category}`}.`,
  noneIn: (category: string, archived: boolean) =>
    `No${archived ? ' archived' : ''} vendors in ${category}.`,
  everyCategory: 'Show every category',
  pages: 'Pages',
  page: (from: number, to: number, total: number) => `${from} to ${to} of ${total}, A to Z`,
  previous: 'Previous',
  next: 'Next',
  archivedOn: (date: string) => `Archived ${date}`,
  restore: 'Restore',

  loading: 'Loading vendors…',
  failed: 'We could not load the vendors.',
  failedLine: 'Check your connection and try again.',
  tryAgain: 'Try again',
  backToSettings: 'Back to Settings',

  addTitle: 'Add a vendor',
  editTitle: 'Edit vendor',
  addVerb: 'Add',
  saveVerb: 'Save',
  saving: 'Saving…',
  name: 'Name',
  category: 'Category',
  chooseCategory: 'Choose a category',
  contact: 'Contact name',
  note: 'Note',
  email: 'Email address',
  phone: 'Phone number',
  website: 'Website',
  address: 'Address',
  optional: 'Optional',
  country: 'Country',
  chooseCountry: 'Choose a country',
  archive: 'Archive this vendor',

  nameBlank: "Enter the vendor's name.",
  categoryBlank: 'Choose the category.',
  emailShape: 'That does not look like an email address. Check it has an @ and a domain.',
  websiteScheme:
    'Enter a web address that starts with https:// or http://, or leave that part off.',
  countryBlank: 'Choose a country.',
  phoneLength: (problem: 'short' | 'long', country: string) =>
    `That number looks too ${problem} for ${country}. Check it and try again.`,
  notANumber: (country: string) =>
    `That is not a phone number for ${country}. Check it and try again.`,
  shorten: (field: string, limit: string) => `Shorten ${field} to ${limit} characters or fewer.`,
  toFix: (count: number) =>
    count === 1
      ? 'One field needs fixing, so nothing was sent.'
      : `${count} fields need fixing, so nothing was sent.`,

  added: (name: string) => `${name} is added.`,
  saved: (name: string) => `${name} is saved.`,
  archivedToast: (name: string) => `${name} is archived. It is under Archived.`,
  restored: (name: string) => `${name} is back in the directory.`,
  discardNew: 'Discard this vendor?',
  discardChanges: 'Discard your changes?',
  discardNewLine: 'Nothing you typed is saved.',
  discardChangesLine: (name: string) => `${name} stays as it was.`,
  keepEditing: 'Keep editing',
  discard: 'Discard',
} as const;
