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
    `${guests === 1 ? '1 guest' : `${figure(guests)} guests`} and ${companions === 1 ? '1 companion' : `${figure(companions)} companions`}`,
  everyoneReplied: 'Everyone has replied.',
  closesToday: 'Replies close today.',
  closesTomorrow: (date: string) => `Replies close tomorrow, ${date}.`,
  closesOn: (date: string) => `Replies close on ${date}.`,
  closedOn: (date: string) => `Replies closed on ${date}.`,
  writeToThem: 'Write to them',
  draftLine: 'Guests can’t be invited until this event is live.',
  pausedLine: 'Guests can’t be invited while this event is paused.',
  finishedLine: 'This event has finished, so guests can’t be invited.',
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
  showAll: (count: number) => `Show all ${figure(count)}`,
  changedSince: 'Changed since you looked',
  nothingChanged: 'Nothing has changed since you last looked.',
  showAllGuests: 'Show all guests',
  repliedAt: (time: string) => `Replied at ${time}`,
  repliedDay: (date: string) => `Replied ${date}`,
  changedAt: (time: string) => `Changed at ${time}`,
  changedDay: (date: string) => `Changed ${date}`,
  updatedNeeds: 'Updated dietary needs',
  linkWrongPerson: 'Link may have reached the wrong person',
  newQuestion: 'New question',
  pick: 'Pick a guest to see their details, or add one.',
  allergy: 'Allergy',
  dietaryNotes: 'Dietary notes',
  loading: 'Loading…',
  loadFailed: 'We could not load the guests.',
  loadFailedLine: 'Check your connection and try again.',
  retry: 'Try again',

  repliedOn: (date: string) => `replied ${date}`,
  askedOn: (date: string) => `asked to decide by ${date}`,
  willBeAskedAgain: (date: string) => `will be asked again ${date}`,
  askedAgain: (date: string) => `asked again ${date}`,
  wontBeAskedAgain: 'won’t be asked again',
  recordedOn: (name: string, how: string, date: string) => `recorded by ${name}, ${how}, ${date}`,
  withWord: (word: string, rest: string) => `${word} · ${rest}`,
  invitedBy: (name: string, how: string, date: string) => `Invited by ${name}, ${how}, ${date}`,
  invitedByMessage: (date: string) => `Invited by Soirely’s message, ${date}`,
  invitedWhenReplied: (date: string) => `Invited when they replied, ${date}`,
  markNotInvited: 'Mark as not invited',
  unmarked: 'Marked as not invited.',
  unmarkRefused: (name: string, reply: string, date: string) =>
    `Not changed. ${name} replied ${reply} on ${date}, so they stay invited.`,
  readOnlyInvited:
    'You can see names, replies and who is invited. Marking guests as invited needs a host or organiser role.',
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
  linkReplacedNote: (name: string) =>
    `Link replaced. ${name}’s old link no longer works. Copy the new one and send it.`,
  flaggedTitle: 'Their link may have reached the wrong person',
  flaggedLine: (name: string) =>
    `Someone who opened ${name}’s link told us it was not meant for them. The reply is unchanged. Replace the link so the old one stops working, then send ${name} the new one.`,
  howInvited: 'How did you invite them?',
  howInvitedBlank: 'Choose how you invited them.',
  markNotSaved: 'Not saved. They are still Not yet invited. Try again.',
  sendOnWhatsApp: 'Send on WhatsApp',
  sendOnWhatsAppTo: (name: string) => `Send on WhatsApp to ${name}`,
  sendLine: 'Opens WhatsApp with their invitation written, for you to send',
  sentOnWhatsApp: (name: string) => `Sent to ${name} on WhatsApp?`,
  notSent: 'Not sent',
  ifNotOpened: 'If WhatsApp didn’t open, use Copy invitation link instead.',
  conversation: 'Their conversation',
  messages: (count: number) => `${figure(count)} messages`,
  conversationLine: 'Parking at The Landmark · SMS · Delivered',
  repliesClosed: (date: string) =>
    `Replies closed on ${date}. Record a reply opens again if you let them change their reply.`,
  letThemChange: 'Let them change their reply',
  reopened: (name: string, date: string) =>
    `Reply reopened by ${name}, ${date}. They can answer until the event starts.`,
  notFound: 'This guest is not on this list',
  eventGone: 'This event is not available',
  notFoundLine: 'They may have been removed from the list since you opened it.',
  backToGuests: 'Back to guests',

  editGuest: 'Edit guest',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  done: 'Done',
  fullName: 'Full name',
  optional: 'Optional',
  language: 'Language',
  notSet: 'Not set',
  languageHint:
    'Their page opens in their browser’s language when Soirely offers it, otherwise in this language. Messages use this language. When this is Not set, both use your organisation’s language.',
  notSetLine: (organisation: string) =>
    `Not set · their browser’s language, or ${organisation} when Soirely does not offer it`,
  theyChose: (language: string) => `They chose ${language} on their page, and that wins.`,
  greetAs: 'Greet as',
  greetAsHint:
    'How messages greet them, such as Auntie Bisi or Dr. Okafor. Leave it blank to use their full name.',
  greetAsTooLong: (most: number) => `Shorten Greet as to ${figure(most)} characters or fewer.`,
  greetsThemAs: (greetAs: string) => `Messages greet them as “${greetAs}”.`,
  greetsByName: 'Messages greet them by their full name.',
  country: 'Country',
  keepsLink: 'Changing the email address or mobile number keeps their invitation link as it is.',
  companions: 'Companions',
  placesFor: 'Places for companions',
  fewerPlaces: 'Fewer places',
  morePlaces: 'More places',
  namedOf: (named: number, places: number) => `${figure(named)} of ${figure(places)} named`,
  placesRefused: (name: string, named: number) =>
    `${name} already has ${figure(named)} named. Remove some first.`,
  thisGuest: 'This guest',
  namedByGuest: 'Named by the guest',
  ofMost: (count: number, most: number) => `${figure(count)} of ${figure(most)}`,
  companionName: (nth: number, count: number) =>
    `Companion’s full name, ${figure(nth)} of ${figure(count)}`,
  remove: 'Remove',
  removeNamed: (name: string) => `Remove ${name}`,
  removeCompanionOf: (host: string) => `Remove ${host}’s guest`,
  removeCompanionOfNth: (host: string, nth: number) => `Remove ${host}’s guest · ${figure(nth)}`,
  removed: (name: string) => `${name} removed. Save to keep the change.`,
  removeTitle: (name: string) => `Remove ${name}?`,
  /** The AC's line (sc-3773, 21 Oct): full name, what goes, no pronoun; a seat or a meal alone is a proposal for [en]. */
  seatedLine: (name: string, table: string | null, meal: boolean) =>
    table != null && meal
      ? `${name} has a seat at ${table} and a meal chosen. Removing this companion frees the seat and drops the meal.`
      : table != null
        ? `${name} has a seat at ${table}. Removing this companion frees the seat.`
        : `${name} has a meal chosen. Removing this companion drops the meal.`,
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

  whatsApp: 'WhatsApp',
  notAgreed: 'Has not agreed to WhatsApp',
  guestAgreed: 'The guest agreed to WhatsApp',
  agreedToWhatsApp: 'Agreed to WhatsApp',
  agreedOn: (date: string) => `Agreed to WhatsApp on ${date}`,
  /** Three whole keys, one per How? answer (pm #36836): never built from pieces. */
  agreedHost: {
    'In person': (name: string, date: string) =>
      `Agreed to WhatsApp in person, recorded by ${name} on ${date}`,
    'By phone': (name: string, date: string) =>
      `Agreed to WhatsApp by phone, recorded by ${name} on ${date}`,
    'In writing': (name: string, date: string) =>
      `Agreed to WhatsApp in writing, recorded by ${name} on ${date}`,
  },
  optedOut: (date: string) => `Unsubscribed from WhatsApp on ${date}`,
  onlyTheGuest: 'Only the guest can change this.',
  forAgreed: (name: string, mobile: string) =>
    `For ${name}, on ${mobile}. It will show as recorded by you.`,
  howAgreed: 'How?',
  howAgreedBlank: 'Choose how they agreed.',

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
