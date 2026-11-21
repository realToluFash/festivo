import type { BestWay, FoundVia, LostReason } from './enquiries.ts';

const grouped = (count: number): string => count.toLocaleString('en');

export const NAME_MOST = 100;
export const MIND_MOST = 5000;
export const WHERE_MOST = 200;
export const GUESTS_MOST = 100_000;
export const LOST_LINE_MOST = 200;

export const BEST_WAY_WORDS: Record<BestWay, string> = {
  phone: 'Phone call',
  whatsapp: 'WhatsApp',
  text: 'Text message',
  email: 'Email',
};

export const FOUND_VIA_WORDS: Record<FoundVia, string> = {
  phone: 'Phone call',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  referral: 'Referral',
  website: 'Website',
  fair: 'Event or fair',
  other: 'Other',
};

export const LOST_WORDS: Record<LostReason, string> = {
  elsewhere: 'Chose someone else',
  budget: 'Budget',
  date: 'Date not available',
  silent: 'Stopped replying',
  notGoingAhead: 'Not going ahead',
  other: 'Other',
};

export const FORM_WORDS = {
  newTitle: 'New enquiry',
  editTitle: 'Edit enquiry',
  name: 'Client’s name',
  nameBlank: 'Enter the client’s name.',
  nameLong: `Keep the name to ${NAME_MOST} characters.`,
  phone: 'Phone',
  code: 'Code',
  phoneWrong: (country: string) =>
    `That is not a phone number for ${country}. Check it and try again.`,
  phoneShort: (country: string) =>
    `That number looks too short for ${country}. Check it and try again.`,
  phoneLong: (country: string) =>
    `That number looks too long for ${country}. Check it and try again.`,
  email: 'Email',
  emailWrong: 'That does not look like an email address. Check it has an @ and a domain.',
  contactHint: 'Add a phone or an email, or both.',
  contactMissing: 'Add a phone or an email, so you can reach the client.',
  mind: 'What they have in mind',
  mindHint: 'Saved as the first note.',
  mindLong: `Keep it to ${grouped(MIND_MOST)} characters.`,
  counter: (count: number, most: number) => `${grouped(count)} of ${grouped(most)}`,
  aboutHeading: 'About the event',
  aboutLine: 'All optional. Fill in what they said.',
  bestWay: 'Best way to reach them',
  type: 'Event type',
  notGiven: 'Not given',
  date: 'Date',
  datePassed: 'The date has passed.',
  guests: 'Guests',
  guestsWrong: `Enter a whole number from 1 to ${grouped(GUESTS_MOST)}.`,
  where: 'Where',
  whereHint: 'A venue or an area.',
  whereLong: `Keep it to ${WHERE_MOST} characters.`,
  budget: 'Budget they mentioned',
  amount: 'Amount',
  currency: 'Currency',
  amountLow: 'Enter an amount above 0.',
  decimals: (currency: string, places: number) =>
    places === 0
      ? `${currency} takes no decimal places.`
      : `${currency} takes ${places} decimal ${places === 1 ? 'place' : 'places'}.`,
  notCode: 'Choose a currency from the list.',
  foundVia: 'How they found you',
  assignedTo: 'Assigned to',
  you: (name: string) => `${name} (you)`,
  save: 'Save enquiry',
  saveChanges: 'Save changes',
  saving: 'Saving…',
  cancel: 'Cancel',
  noConnection: 'There’s no connection, so nothing was saved. Everything you typed is still here.',
  tryAgain: 'Try again',
  saved: 'Enquiry saved.',
  duplicate: (by: 'phone' | 'email', client: string, person: string | null) =>
    `There’s already an open enquiry from this ${by === 'phone' ? 'number' : 'email'}: ${client}, ${
      person == null ? 'not assigned' : `assigned to ${person}`
    }`,
  duplicateHidden: (by: 'phone' | 'email') =>
    `There’s already an open enquiry with this ${by === 'phone' ? 'number' : 'email'}. An owner or admin can see it.`,
  openIt: 'Open it',
} as const;

export const PAGE_WORDS = {
  open: 'Open',
  lost: 'Lost',
  reach: 'Reach them',
  call: (phone: string) => `Call ${phone}`,
  whatsapp: 'WhatsApp',
  bestWayLine: (way: string) => `Best way: ${way}`,
  about: 'About the event',
  edit: 'Edit',
  assignedYou: 'Assigned to you',
  notes: (count: number) => `Notes · ${count}`,
  addNote: 'Add a note',
  addNoteButton: 'Add note',
  noteLong: `Keep it to ${grouped(MIND_MOST)} characters.`,
  noteEmpty: 'Write the note first.',
  noNotes: 'No notes yet.',
  edited: 'Edited',
  editNote: 'Edit',
  editNoteLabel: 'Edit the note',
  saveNote: 'Save note',
  cancel: 'Cancel',
  closeAsLost: 'Close as lost…',
  panelTitle: 'Close as lost',
  panelLine: 'It moves to Lost. You can reopen it.',
  why: 'Why was it lost?',
  anything: 'Anything to add',
  anythingLong: `Keep it to ${LOST_LINE_MOST} characters.`,
  chooseWhy: 'Choose why it was lost.',
  keepOpen: 'Keep it open',
  confirm: 'Close as lost',
  closed: 'Closed as lost.',
  reopen: 'Reopen',
  reopened: 'Reopened. It is back on Open.',
  notFoundTitle: 'This enquiry isn’t here',
  notFoundLine: 'It may have been reassigned, or you may not have access.',
  backTo: 'Back to Enquiries',
  loadFailed: 'The enquiry did not load. Try again in a moment.',
  loading: 'Loading the enquiry…',
} as const;
