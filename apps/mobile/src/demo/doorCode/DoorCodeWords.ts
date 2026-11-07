/** The door code's English, as access-a-spec.md §8 lists it: sc-72's, sc-4235's, People's, the app's, pm's and the new words. */
export const W = {
  doorCode: 'Door code',
  noneSays: 'No door code yet',
  noneLine: 'One code lets a crew in on the day. Each person gives their name and number.',
  makeFirst: 'Make a door code',
  another: 'Make another door code',
  hold: 'Hold it up',
  makeNew: 'Make a new code',
  stop: 'Stop this code',
  full: 'Full',
  stopped: 'Stopped',
  ranOut: 'Ran out',
  make: 'Make',
  making: 'Making…',
  theirRole: 'Their role',
  theirRoleSaid: 'Their role on this event',
  jobLabel: 'Job label (optional)',
  jobHelp: 'What they’re there for, shown beside their name. It grants nothing.',
  howMany: 'How many people',
  howManyHelp: 'From 1 to 500.',
  ends: 'Ends',
  whenEventEnds: 'When the event ends',
  earlier: 'Earlier',
  earlierLine: 'A day and time before the event ends.',
  day: 'Day',
  time: 'Time',
  done: 'Done',
  capBlank: 'Enter how many people can use this code.',
  capRange: 'Use a whole number from 1 to 500.',
  past: 'Choose a time that hasn’t passed yet.',
  noEdit: 'A code can’t give edit access. Give that to a named person instead.',
  makeFailed: 'We couldn’t make the code. Check your connection and try again.',
  made: 'Door code made.',
  newTitle: 'Make a new code?',
  keepThis: 'Keep this one',
  stopTitle: 'Stop this code?',
  keepIt: 'Keep it',
  stopping: 'Stopping…',
  stopFailed: 'We couldn’t stop the code, so it still works. Check your connection and try again.',
  close: 'Close',
  enterCode: 'Enter a join code',
  joinCode: 'Join code',
  codeBlank: 'Enter the join code.',
  codeShort: 'A join code is 8 letters and numbers.',
  continue: 'Continue',
  refused: 'That code doesn’t work. Check it with whoever gave it to you.',
  tooMany: 'Too many tries',
  yourName: 'Your name',
  countryCode: 'Country code',
  mobileNumber: 'Mobile number',
  sendCode: 'Send code',
  nameBlank: 'Enter your full name.',
  numberBlank: 'Enter your mobile number.',
  checkWhatsApp: 'Check WhatsApp',
  checkMessages: 'Check your messages',
  codeLabel: 'Code, 6 digits',
  textInstead: 'Text it to me instead',
  sendNew: 'Send a new code',
  expiredTitle: 'That code has expired',
  expiredBody: 'Codes only work for a while. Send a new one and use the code in the newest text.',
  exhaustedTitle: 'Too many wrong tries',
  exhaustedBody: 'That code no longer works. Send a new one to carry on.',
  failedTitle: 'That did not work',
  failedBody: 'Something went wrong on the way. Try again in a moment.',
  memberLine: 'Members reach an event through its People. Ask its lead or an admin to add you.',
  openEvents: 'Open Events',
  endsLine: 'Access ends when the event concludes.',
  openEvent: 'Open the event',
  signOut: 'Sign out',
  checkIn: 'Check guests in',
  guests: 'Guests',
  guestsLine: 'Names and replies, no contact details',
  people: 'People',
  overview: 'Overview',
  menu: 'Menu',
  messages: 'Messages',
  more: 'More',
  yourAccount: 'Your account',
  address: 'soirely.com/join',
} as const;

export function cardTop(role: string, job: string | null): string {
  return ['Door code', role, job].filter((part) => part != null && part !== '').join(' · ');
}

/** "Q 7 K M, 4 X P 2": a screen reader hears each character, the two groups apart. */
export function codeSaid(code: string): string {
  return code
    .split(' ')
    .map((group) => [...group].join(' '))
    .join(', ');
}

export function joinCodeSaid(code: string): string {
  return `${W.joinCode} ${codeSaid(code)}`;
}

export function qrSaid(code: string): string {
  return `QR code for the join code ${codeSaid(code)}`;
}

export function usedUntil(used: number, cap: number, until: string): string {
  return `${used} of ${cap} used · until ${until}`;
}

export function usedEnded(used: number, cap: number, at: string): string {
  return `${used} of ${cap} used · ended at ${at}`;
}

/** sc-72's count of who is in; the singular is this build's, for the linguist. */
export function cameIn(people: number): string {
  return people === 1
    ? '1 person came in with it. They keep their access.'
    : `${people} people came in with it. They keep their access.`;
}

function alreadyIn(people: number): string {
  return people === 1
    ? 'The 1 person already in keeps their access.'
    : `The ${people} people already in keep their access.`;
}

export function newLine(code: string, people: number): string {
  return `${code} stops working. ${alreadyIn(people)}`;
}

export function stopLine(people: number): string {
  return `Nobody new can use it. ${alreadyIn(people)}`;
}

export function jobCount(job: string): string {
  return `${W.jobHelp} ${[...job].length} of 60.`;
}

export function tooShortFor(country: string): string {
  return `That number looks too short for ${country}. Check it and try again.`;
}

export function tryAgainAt(time: string): string {
  return `Try again at ${time}`;
}

export function sentTo(number: string, texted: boolean): string {
  return texted
    ? `We texted a code to ${number}.`
    : `We sent a code to your WhatsApp on ${number}.`;
}

export function wrongCode(texted: boolean): string {
  return `That code does not match. Check the newest ${texted ? 'text' : 'WhatsApp message'} from Soirely and try again.`;
}

export function resendIn(time: string): string {
  return `Send a new code in ${time}`;
}

export function memberTitle(organisation: string): string {
  return `You’re already a member of ${organisation}`;
}

export function youreIn(event: string, job: string | null): string {
  return job == null ? `You’re in for ${event}` : `You’re in for ${event} · ${job}`;
}

export function joinAs(name: string): string {
  return `Join as ${name}`;
}

export function signedInAs(name: string): string {
  return `Signed in as ${name}`;
}

export function onEventCount(people: number): string {
  return `${people} on this event`;
}
