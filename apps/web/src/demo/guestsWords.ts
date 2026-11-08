/** Guests in A · Summary first (page e30, guests-a-spec §16): the boards' English, kept in the demo; the developer puts it in the four locales when building the product's screen. */

const NUMBER = new Intl.NumberFormat('en-US');

/** A count in the language's digits and grouping (CLDR). */
export function figure(count: number): string {
  return NUMBER.format(count);
}

export const GW = {
  title: 'Guests',
  addGuest: 'Add guest',
  crumb: 'Breadcrumb',
  events: 'Events',

  noGuests: 'No guests yet',
  comingOf: (coming: number, invited: number) =>
    `${figure(coming)} coming of ${figure(invited)} invited`,
  onList: (count: number) => `${figure(count)} on the list`,
  havent: (count: number) =>
    count === 1 ? '1 hasn’t replied' : `${figure(count)} haven’t replied`,
  whoHavent: (guests: number, companions: number) =>
    `${guests === 1 ? '1 guest' : `${figure(guests)} guests`} and ${figure(companions)} of their companions`,
  closesTomorrow: (date: string) => `Replies close tomorrow, ${date}.`,
  closedOn: (date: string) => `Replies closed on ${date}.`,
  writeToThem: 'Write to them',
  draftLine: 'Guests can’t be invited until this event is live.',
  pausedLine: 'Guests can’t be invited while this event is paused.',
  makeLive: 'Make live',
  arrivedOf: (arrived: number, expected: number) => `${figure(arrived)} of ${figure(expected)}`,
  arrived: 'arrived',
  checkInOpened: (time: string) => `Check-in opened at ${time}.`,
  openAllDay: 'Check-in is open all day.',
  checkInOpens: (time: string) => `Check-in opens at ${time}`,

  find: 'Find a guest',
  clearSearch: 'Clear the search',
  shown: (count: number, total: number) => `${figure(count)} of ${figure(total)} shown`,
  clear: 'Clear',
  noMatch: 'No guests match',
  noMatchLine: 'Try a different name, or clear the filters.',
  showAll: (count: number, word: string) => `Show all ${figure(count)} ${word}`,
  pick: 'Pick a guest to see their details, or add one.',
  loading: 'Loading…',
  loadFailed: 'We could not load the guests.',
  loadFailedLine: 'Check your connection and try again.',
  retry: 'Try again',

  repliedOn: (date: string) => `replied ${date}`,
  askedOn: (date: string) => `asked to decide by ${date}`,
  recordedOn: (name: string, how: string, date: string) => `recorded by ${name}, ${how}, ${date}`,
  withWord: (word: string, rest: string) => `${word} · ${rest}`,
  invitedBy: (name: string, how: string, date: string) => `Invited by ${name}, ${how}, ${date}`,
  invitedByMessage: (date: string) => `Invited by Soirely’s message, ${date}`,
  companionCount: (count: number) => (count === 1 ? '1 companion' : `${figure(count)} companions`),
  heldLine: 'Held · comes only if their host accepts',
  guestOf: (host: string) => `Guest of ${host}`,
  guestOfNth: (host: string, nth: number) => `Guest of ${host} · ${figure(nth)}`,
  walkIn: (time: string) => `Walk-in · Arrived ${time}`,

  reply: 'Reply',
  recordReply: 'Record a reply',
  details: 'Details',
  edit: 'Edit',
  emailAddress: 'Email address',
  mobileNumber: 'Mobile number',
  none: 'None',
  companion: (word: string) => `Companion · ${word}`,
  heldCompanion: 'Companion · Held · comes only if their host accepts',
  added: 'Added',
  addedBy: (date: string, name: string) => `${date} by ${name}`,
  invitation: 'Invitation',
  copyLink: 'Copy invitation link',
  copyLinkLine: 'Their own page, where they reply',
  replaceLink: 'Replace link…',
  replaceLinkLine: 'The old link stops working straight away',
  markAsInvited: 'Mark as invited',
  markLine: 'How you invited them, so they count as invited',
  copyFirst: 'Copying their link does not mark them. Mark them once you have sent it.',
  linkCopied: 'Link copied',
  invitationLink: 'Invitation link',
  clipboardRefused: 'Your browser didn’t let Soirely copy it. It is selected: copy it from here.',
  replaceTitle: (name: string) => `Replace ${name}’s link?`,
  replaceLine: 'The old link will stop working straight away.',
  keepIt: 'Keep it',
  replace: 'Replace link',
  linkReplaced: (date: string) => `Link replaced ${date}`,
  linkReplacedLine: 'They still hold the old one until you send the new link.',
  notReplaced: 'Not replaced. The old link still works. Try again.',
  howInvited: 'How did you invite them?',
  howInvitedBlank: 'Choose how you invited them.',
  markNotSaved: 'Not saved. They are still Not yet invited. Try again.',
  conversation: 'Their conversation',
  messages: (count: number) => `${figure(count)} messages`,
  conversationLine: 'Parking at The Landmark · SMS · Delivered',
  repliesClosed: (date: string) =>
    `Replies closed on ${date}. Record a reply opens again if you let them change their reply.`,
  letThemChange: 'Let them change their reply',
  reopened: (name: string, date: string) =>
    `Reply reopened by ${name}, ${date}. They can answer until the event starts.`,
  notFound: 'This guest isn’t on this list',
  notFoundLine: 'They may have been removed from the list since you opened it.',
  backToGuests: 'Back to guests',

  editGuest: 'Edit guest',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  done: 'Done',
  fullName: 'Full name',
  optional: 'Optional',
  country: 'Country',
  keepsLink: 'Changing the email address or mobile number keeps their invitation link as it is.',
  companions: 'Companions',
  noneYet: (most: number) => `None yet · 0 of ${figure(most)}`,
  ofMost: (count: number, most: number) => `${figure(count)} of ${figure(most)}`,
  companionName: (nth: number, count: number) =>
    `Companion’s full name, ${figure(nth)} of ${figure(count)}`,
  addCompanion: 'Add a companion',
  remove: 'Remove',
  removeNamed: (name: string) => `Remove ${name}`,
  removed: (name: string) => `${name} removed. Save to keep the change.`,
  moreCompanions: (count: number) =>
    count === 1 ? '1 more companion' : `${figure(count)} more companions`,
  mostCompanions: (most: number) => `${figure(most)} companions is the most one guest can bring.`,
  blankName: 'Enter their full name.',
  nameTooLong: (most: number) => `Shorten the name to ${figure(most)} characters or fewer.`,
  emailShape: 'That does not look like an email address. Check it has an @ and a domain.',
  duplicate: (name: string) => `${name} is already on the list`,
  duplicateLine: 'Two guests can share a name. Save them both, or change this one.',
  saveAnyway: 'Save anyway',
  changeName: 'Change the name',
  addAnyway: 'Add anyway',
  conflict: 'Someone else changed this guest. Here is their version.',
  theirs: 'Theirs',
  yours: 'Yours',
  conflictLine:
    'Use theirs puts their version in the form and drops yours. Keep mine saves yours over theirs.',
  useTheirs: 'Use theirs',
  keepMine: 'Keep mine',
  discardTitle: 'Discard your changes?',
  discardLine: (name: string) => `Your changes to ${name} have not been saved.`,
  keepEditing: 'Keep editing',
  discard: 'Discard changes',
  notSaved: 'Not saved. Nothing was changed. Try again.',
  saved: 'Saved',
  justAdded: (name: string) => `${name} added.`,
  notAdded: 'Not added. Nothing was saved. Try again.',

  forName: (name: string) => `For ${name}. It counts as their reply, marked as recorded by you.`,
  theirReply: 'Their reply',
  howTold: 'How did they tell you?',
  whoComing: 'Who’s coming with them',
  places: (places: number, coming: number) =>
    `${places === 1 ? '1 place' : `${figure(places)} places`} · ${figure(coming)} coming. Untick anyone who isn’t coming. Places change with Edit.`,
  recordFoot: (name: string) =>
    `It counts in the numbers straight away and goes in the activity log. ${name} can still change it from their link.`,
  chooseReply: 'Choose their reply.',
  chooseHow: 'Choose how they told you.',
  replaceAsk: (name: string, word: string, date: string) =>
    `${name} replied ${word} themselves on ${date}. Replace it?`,
  replaceAskLine:
    'Your answer takes the place of theirs, marked as recorded by you. They can still change it from their link.',
  replaceTheirs: 'Replace their reply',
  keepTheirs: 'Keep their reply',
  recorded: 'Reply recorded. It counts like any other reply.',

  openList: 'Open the guest list',
  numbersLead: (coming: number, invited: number) =>
    `${figure(coming)} coming of ${figure(invited)} invited. Each number opens the guests it counts.`,
  heldNumber: 'Companions waiting on their guest’s answer',
  notYetLink: (count: number) => `${figure(count)} not yet invited`,
  notYetName: (count: number) =>
    `${figure(count)} not yet invited, opens the guest list showing guests not yet invited`,
  opens: (count: number, word: string) => `${figure(count)} ${word}, opens ${word}`,
  opensInvited: (count: number) =>
    `${figure(count)} Invited, opens the guest list showing invited guests`,
  numbersFailed: 'Guest numbers didn’t load.',
  noneInvited: 'No guests invited yet',
} as const;

/** The reply words, one word for one state (sc-3772, pm 7 Nov: the guest's own Not sure yet, never Maybe). */
export const REPLY_WORDS = {
  coming: 'Coming',
  notSure: 'Not sure yet',
  noReply: 'No reply',
  notComing: 'Not coming',
  held: 'Held',
  notYet: 'Not yet invited',
  walkIn: 'Walk-in',
} as const;

/** What a group's Show all says after its count. */
export const SHOW_ALL_WORDS = {
  coming: 'coming',
  notSure: 'not sure yet',
  noReply: 'with no reply',
  notComing: 'not coming',
  held: 'held',
  notYet: 'not yet invited',
  walkIn: 'walk-ins',
} as const;

export const CHOICE_WORDS = { all: 'All', invited: 'Invited', ...REPLY_WORDS } as const;

/** How a host heard a reply (sc-3787), and how a guest was invited (sc-3788): the word, then as it reads mid-sentence. */
export const HOW_TOLD = ['By phone', 'In person', 'By message', 'Other'] as const;
export const HOW_INVITED = ['WhatsApp', 'Text message', 'Email', 'In person', 'Other'] as const;

export type HowTold = (typeof HOW_TOLD)[number];
export type HowInvited = (typeof HOW_INVITED)[number];

/** sc-3787 (Decided, 21 Oct): Other reads "another way"; a brand keeps its capital. */
export function midSentence(how: string): string {
  if (how === 'Other') return 'another way';
  if (how === 'WhatsApp') return how;

  return how.charAt(0).toLowerCase() + how.slice(1);
}
