import type { Translate } from '@soirely/domain';

import type { AreaKey } from './EventsSample.ts';

/** Main's English for Events, with the curly apostrophes the boards draw, and the words pm accepted on 6 Nov 2026. */
export const W = {
  events: 'Events',
  loading: 'Loading events…',
  loadingEvent: 'Loading the event…',
  newEvent: 'New event',
  search: 'Search events',
  clearSearch: 'Clear search',
  filter: 'Filter',
  all: 'All',
  clearFilters: 'Clear filters',
  type: 'Type',
  when: 'When',
  hostedBy: 'Hosted by',
  anyType: 'Any type',
  anyTime: 'Any time',
  anyone: 'Anyone',
  thisWeek: 'This week',
  thisMonth: 'This month',
  next3Months: 'Next 3 months',
  between: 'Between dates…',
  from: 'From',
  to: 'To',
  closeMenu: 'Close the menu',
  noMatch: 'No events match',
  searchOffline: 'Search needs a connection.',
  tryAgain: 'Try again',
  moreFailed: 'More finished events did not load. Check your connection and try again.',
  upcoming: 'Upcoming',
  drafts: 'Drafts',
  past: 'Past',
  showMore: 'Show more',
  firstRunTitle: 'Set up your first event',
  firstRunCreate: 'Create an event',
  creating: 'Creating an event',
  choosingPhoto: 'Choosing a photo',
  firstRunSteps: [
    'Name it and choose when it starts and ends.',
    'Check its time zone and currency.',
    'Open it from this list to carry on planning.',
  ],
  draft: 'Draft',
  live: 'Live',
  happeningNow: 'Happening now',
  paused: 'Paused',
  finished: 'Finished',
  calledOff: 'Called off',
  today: 'Today',
  makeLive: 'Make live',
  changeDates: 'Change dates',
  resume: 'Resume',
  duplicate: 'Duplicate',
  guestsBlocked: 'Guests can’t be invited until this event is live.',
  endPassed: 'This event’s end has passed, so it cannot be made live. Change its dates first.',
  pausedNotice: 'Paused. Guests can’t reply or change anything until you resume it.',
  timelineFinished: 'Nothing coming up. Every date on this event has passed.',
  details: 'Details',
  dates: 'Dates',
  venue: 'Venue',
  venueToBeConfirmed: 'Venue to be confirmed',
  openInMaps: 'Open in maps',
  mapsHandOff: 'Open in maps hands the address to your maps app.',
  currency: 'Currency',
  nameAndCover: 'Name and cover',
  eventName: 'Event name',
  cover: 'Cover',
  defaultCover: 'Default cover',
  yourPhoto: 'Your photo',
  guestsPage: 'Guests’ page',
  previewGuestsPage: 'Preview the guests’ page',
  previewLine: 'What somebody you invite sees, before they reply',
  previewPill: 'AC, not yet built · sc-1439',
  justForYou: 'Just for you',
  mute: 'Mute this event',
  muteNote: 'Nobody else on this event is affected.',
  muteNotLoaded: 'Could not check whether this event is muted.',
  muteNotSaved: 'Not saved. Try again.',
  guestsCanWrite: 'Guests can write from their page',
  guestsCanWriteLine: 'Changes it for everyone on this event. Texts and emails still arrive.',
  guestsCanWriteReadOnly: 'Only members who manage messages can change this.',
  guestsCanWriteNotSaved: 'Not saved. Try again.',
  on: 'On',
  off: 'Off',
  notificationSettings: 'Notification settings',
  manage: 'Manage',
  duplicateLine:
    'Makes a new draft with the same name. Only your team sees it until you make it live.',
  pause: 'Pause',
  pauseLine:
    'Guests can’t reply or change anything until you resume it. Nothing is lost. Check-in and service keep working.',
  callOffOpen: 'Call off…',
  callOffLine: 'It won’t go ahead. Guests following their link will be told. You can’t undo this.',
  endNowOpen: 'End now…',
  endLine: 'It will be over for everybody. You can’t undo this.',
  deleteOpen: 'Delete event…',
  deleteLine:
    'Removes the event and everything in it for your whole team. Guests following its link see that it isn’t available.',
  more: 'More',
  closeMore: 'Close More',
  backToEvents: 'Events',
  overview: 'Overview',
  cancel: 'Cancel',
  save: 'Save',
  saved: 'Saved',
  discardTitle: 'Discard your change?',
  keepEditing: 'Keep editing',
  discard: 'Discard',
  discardLine: 'What you changed here is not saved.',
  changedElsewhere:
    'Not saved. Somebody else changed this event since you opened it. What you typed is still here.',
  showLatest: 'Show the latest',
  showLatestTitle: 'Show the latest version?',
  showLatestBody: 'What you typed will be replaced by the version somebody else saved.',
  starts: 'Starts',
  ends: 'Ends',
  date: 'Date',
  time: 'Time',
  done: 'Done',
  endsHint: 'An event can run past midnight. Choose the day it ends.',
  endBeforeStart: 'The end is before the start. Choose a later end.',
  replyBy: 'Reply by',
  replyByNone: 'Replies stay open until the event starts.',
  repliesClosed: 'Replies closed.',
  replyByNotBefore: 'Choose a date before the event starts.',
  removeTheDate: 'Remove the date',
  closeSooner: 'Close replies sooner',
  closeSoonerLine: 'After that day they can’t reply, unless you let them change their reply.',
  closeNow: 'Close replies now',
  closeNowLine: 'From now on they can’t reply, unless you let them change their reply.',
  closeNowTitle: 'Close replies now?',
  replyByRemoved: 'Saved. Replies stay open until the event starts.',
  savedClosedNow: 'Saved. Replies are now closed.',
  repliesClosedNow: 'Replies are now closed.',
  timeZone: 'Time zone',
  venueName: 'Venue name',
  address: 'Address',
  optional: 'Optional',
  venueAddressHint: 'Type at least 3 characters to see suggestions. You can also type any address.',
  venueLookupDown:
    'Suggestions aren’t available right now. Type the address in full and it will be saved as you typed it.',
  hostsExplainer:
    'Guests read these names on their invitation and their page, in this order. Write them the way you want guests to see them.',
  addHost: 'Add a host',
  remove: 'Remove',
  hostsMost: '6 is the most hosts an event can have.',
  lastHost:
    'Guests can see this event, so it needs at least one host. You can still change this name.',
  hostBlank: 'Enter a name or remove this host.',
  searchTypes: 'Search types',
  currencyInUse: 'The currency cannot change once amounts are recorded against this event.',
  nameBlank: 'Give the event a name.',
  coverPhoto: 'Cover photo',
  useThisPhoto: 'Use this photo',
  coverDefaultLine: 'Soirely’s cover, in this event’s own colours. Add your own photo if you like.',
  upload: 'Upload a photo',
  accepted: 'JPEG, PNG, WebP or HEIC, up to 15 MB, at least 1200 × 675 pixels.',
  coverRefused:
    'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
  changePhoto: 'Change photo',
  position: 'Photo position',
  top: 'Top',
  bottom: 'Bottom',
  showingTop: 'Showing the top of the photo',
  showingMiddle: 'Showing the middle of the photo',
  showingBottom: 'Showing the bottom of the photo',
  describe: 'Describe the image',
  describeHint:
    'What a screen reader says for the photo. Leave it blank if the photo is only decoration.',
  removePhoto: 'Remove photo',
  removePhotoLine: 'The default cover comes back.',
  keepItLive: 'Keep it live',
  keepItOn: 'Keep it on',
  callOff: 'Call off',
  endNow: 'End now',
  keepIt: 'Keep it',
  delete: 'Delete',
  deleteEvent: 'Delete event',
  draftBody: 'It’s a draft with nobody on its guest list. It will be removed for your whole team.',
  removes: 'This removes, for your whole team:',
  removesEvent: 'the event, its details and its schedule',
  deleteGuests: 'Guests following their link will see that it isn’t available.',
  typeHint: 'Type it exactly, capitals included. A straight or curly apostrophe both count.',
  createDraft: 'Create draft',
  copied: 'Copied',
  copiedList: [
    'Name',
    'Type',
    'Venue',
    'Cover and its description',
    'Time zone',
    'Currency',
    'Length',
  ],
  notCopied: 'Not copied',
  notCopiedList: ['Hosts', 'Guests', 'Replies', 'Anything that happened at the event'],
  created: 'Draft created. Opening it.',
  pauseBody:
    'Guests can’t reply or change anything until you resume it. Nothing is lost. Check-in and service keep working.',
  callOffBody: 'It won’t go ahead. Guests following their link will be told. You can’t undo this.',
  endBody: 'It will be over for everybody. You can’t undo this.',
  callOffFirstBody:
    'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. Calling it off is how they hear it will not go ahead.',
  endFirstBody:
    'Guests have been invited to this event, or staff briefed for it, so it can be deleted only once it is finished. End it first: it will then be over for everybody.',
} as const;

export const AREA_WORDS: Record<AreaKey, string> = {
  overview: 'Overview',
  guests: 'Guests',
  menu: 'Menu',
  seating: 'Seating',
  messages: 'Messages',
  schedule: 'Schedule',
  staff: 'Staff',
  people: 'People',
  budget: 'Budget',
  reports: 'Reports',
};

export const COMING: Record<Exclude<AreaKey, 'overview' | 'people'>, string> = {
  guests: 'The guest list for this event is coming.',
  menu: 'The menu for this event is coming.',
  seating: 'The seating plan for this event is coming.',
  messages: 'Messages for this event are coming.',
  schedule: 'The schedule for this event is coming.',
  staff: 'Staffing for this event is coming.',
  budget: 'The budget for this event is coming.',
  reports: 'Reports for this event are coming.',
};

export const say = {
  inDays: (count: number) => (count === 1 ? 'in 1 day' : `in ${count} days`),
  daysAgo: (count: number) => (count === 1 ? '1 day ago' : `${count} days ago`),
  days: (first: string, last: string) => `${first} to ${last}`,
  calledOffOn: (date: string) => `Called off on ${date}`,
  calledOffNotice: (date: string) =>
    `Called off on ${date}, before it started. Guests following their link are told it won’t go ahead.`,
  nextUp: (title: string) => `Next up: ${title}`,
  starts: (name: string) => `${name} starts`,
  ends: (name: string) => `${name} ends`,
  dayOf: (day: number, of: number) => `Day ${day} of ${of}`,
  summaryUpcoming: (count: number) => `${count} upcoming`,
  summaryHappening: (count: number) => `${count} happening now`,
  summaryDrafts: (count: number) => (count === 1 ? '1 draft' : `${count} drafts`),
  footer: (count: number) => `${count === 1 ? '1 event' : `${count} events`} · Sorted by date`,
  count: (count: number) => (count === 1 ? '1 event' : `${count} events`),
  moreShown: (count: number) =>
    count === 1 ? '1 more finished event shown.' : `${count} more finished events shown.`,
  filterLabel: (what: string) => `Filter: ${what}`,
  searchedAndFiltered: (q: string, filters: string) =>
    `You searched for “${q}” and filtered by ${filters}.`,
  searched: (q: string) => `You searched for “${q}”.`,
  filtered: (filters: string) => `You filtered by ${filters}.`,
  backTo: (word: string) => `‹ ${word}`,
  nameCount: (count: number) => `${count} of 120 characters`,
  describeCount: (count: number) => `${count} of 250 characters`,
  timesIn: (zone: string) => `Times in ${zone}`,
  zoneOffer: (zone: string) => `This venue is in ${zone}. Use it?`,
  zoneUse: (zone: string) => `Use ${zone}`,
  zoneKeep: (zone: string) => `Keep ${zone}`,
  suggestionsBelow: (count: number) =>
    count === 1 ? '1 suggestion below the address.' : `${count} suggestions below the address.`,
  hostLabel: (position: number) => `Host ${position}`,
  moveUp: (name: string) => `Move ${name} up`,
  moveDown: (name: string) => `Move ${name} down`,
  removeNamed: (name: string) => `Remove ${name}`,
  hostDuplicate: (name: string) => `${name} is already a host.`,
  hostMoved: (name: string, position: number, count: number) =>
    `${name} moved to ${position} of ${count}`,
  pauseTitle: (name: string) => `Pause ${name}?`,
  callOffTitle: (name: string) => `Call off ${name}?`,
  endTitle: (name: string) => `End ${name} now?`,
  deleteTitle: (name: string) => `Delete ${name}?`,
  removesGuests: (people: string, count: number) =>
    count === 1
      ? `its guest list, with the ${people} person on it`
      : `its guest list, with the ${people} people on it`,
  deleteWindow: (deadline: string) =>
    `If this was a mistake, support can restore it until ${deadline}. After that it’s gone for good.`,
  deleteType: (name: string) => `Type ${name} to delete it`,
  deleteMismatch: (name: string) => `Type ${name} exactly as shown to delete it.`,
  deleted: (name: string) => `${name} was deleted.`,
  callOffFirst: (name: string) => `Call off ${name} first?`,
  endFirst: (name: string) => `End ${name} first?`,
  askToCallOff: (area: string, organisation: string) =>
    `Ask someone who can change ${area} in ${organisation} to call it off.`,
  askToEnd: (area: string, organisation: string) =>
    `Ask someone who can change ${area} in ${organisation} to end it.`,
  duplicateTitle: (name: string) => `Duplicate ${name}`,
  ownDesign: (what: string) => `${what} has its own design.`,
  repliesCloseAt: (time: string, zone: string) => `Replies close at ${time}, ${zone} time.`,
  replyByHint: (time: string, zone: string) =>
    `Replies close at the end of this day, ${time} ${zone} time. Leave it empty and replies stay open until the event starts.`,
  onGuestsPage: (sentence: string) => `On the guests’ page: “${sentence}”`,
  pleaseAnswerBy: (date: string) =>
    `Please answer by ${date}. You can change your answer any time before then.`,
  closeSoonerTitle: (date: string) => `Close replies sooner, on ${date}?`,
  keepDate: (date: string) => `Keep ${date}`,
  replyByMoves: (old: string, next: string) =>
    `Replies close on ${old}, which isn’t before the new start. Saving moves Reply by to ${next}.`,
  repliesCloseOn: (date: string, time: string, zone: string) =>
    `Replies close on ${date} at ${time}, ${zone} time.`,
  replyBySaved: (date: string, time: string, zone: string) =>
    `Saved. Replies close on ${date} at ${time}, ${zone} time.`,
};

const KEYED: Record<string, (values: Record<string, string | number>) => string> = {
  'eventForm.endMoved': (v) => `Ends moved with the start, to ${String(v.day)}, ${String(v.time)}.`,
  'eventDuplicate.hoursAndMinutes': (v) => `${String(v.hourWords)} ${String(v.minuteWords)}`,
  'eventDuplicate.ends': (v) =>
    `It ends ${String(v.end)}, ${String(v.duration)} later, like the original. Times in ${String(v.timeZone)}.`,
  'eventDuplicate.endsUnchosen': (v) =>
    `It ends ${String(v.duration)} after it starts, like the original. Times in ${String(v.timeZone)}.`,
};

/** The few of main's keys the domain's word helpers ask for, in English. */
export const t: Translate = (key: string, values: Record<string, string | number> = {}) =>
  KEYED[key]?.(values) ?? key;

/** sc-3971: Make live in main's eventLive.* English, the offer in the story's copy as pm and l10n settled it (#45231, #45271, #45310). */
export const LIVE = {
  makeLive: 'Make live',
  notYet: 'Not yet',
  making: 'Making live…',
  confirmLine: 'Guests can be invited, and they can see it. It can’t go back to being a draft.',
  failed: 'Not made live. Try again in a moment.',
  madeLive: '✓ Live',
  close: 'Close',
  sending: 'Sending…',
  notSent: 'Not sent. Try again in a moment.',
  forbidden: 'Your role no longer includes sending messages, so nothing was sent.',
  messages: 'Messages',
} as const;

const LIVE_COUNTED = {
  offerTitle_one: 'Send the invitation to 1 guest now?',
  offerTitle_other: 'Send invitations to {{count}} guests now?',
  send_one: 'Send it',
  send_other: 'Send them',
  queued_one: 'Invitation queued. Sending to 1 guest now.',
  queued_other: 'Invitations queued. Sending to {{count}} guests now.',
  cannotTitle_one: 'The invitation cannot be sent yet.',
  cannotTitle_other: 'The invitations cannot be sent yet.',
  later_one: 'You can send the invitation later from Guests in Soirely on the web.',
  later_other: 'You can send the invitations later from Guests in Soirely on the web.',
  textsUse_one: 'Texts use 1 credit.',
  textsUse_other: 'Texts use {{count}} credits.',
  nobody_one:
    'This guest cannot be reached. Add an email address or a mobile number for them in Guests.',
  nobody_other:
    'None of the {{count}} guests can be reached. Add an email address or a mobile number for them in Guests.',
} as const;

type Counted = keyof typeof LIVE_COUNTED extends `${infer Key}_${'one' | 'other'}` ? Key : never;

/** One of the _one/_other families, its count written as a number in the reader's locale. */
export function liveCounted(key: Counted, count: number, locale = 'en-US'): string {
  const words = count === 1 ? LIVE_COUNTED[`${key}_one`] : LIVE_COUNTED[`${key}_other`];

  return words.replace('{{count}}', new Intl.NumberFormat(locale).format(count));
}

export const sayLive = {
  confirmTitle: (name: string) => `Make ${name} live?`,
  isLive: (name: string) => `${name} is live.`,
};
