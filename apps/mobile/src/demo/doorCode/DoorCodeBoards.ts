import type { HoldState, MakeState, PeopleDoorState } from './DoorCodeModel.ts';
import type { RedeemState } from './RedeemModel.ts';

/** People's own states the door code shares, named in access-a-spec.md §5. */
type Shared = 'loading' | 'failed' | 'readOnly';

const PEOPLE: Record<PeopleDoorState | Shared, readonly [string, string]> = {
  'code-none': ['People · no code yet', 'The card offers Make a door code'],
  code: ['People · the code working', 'Q7KM 4XP2, 14 of 30, Hold it up'],
  'code-two': ['People · two codes', 'A card each, 21 on the event'],
  'code-full': ['People · full', 'The Cloakroom code at 5 of 5, its five listed'],
  'code-stopped': ['People · stopped', '14 people came in and keep their access'],
  'code-ran-out': ['People · ran out', 'Ended at 15:00, its step a new code'],
  'code-made': ['People · made', 'The new card, Door code made.'],
  loading: ['People · loading, People’s own', 'Ire Events’ sample, as People built it'],
  failed: ['People · failed, People’s own', 'Try again loads again'],
  readOnly: ['People · read only, People’s own', 'No card, no Add, nothing opens'],
  'code-person': ['People · João’s sheet', 'In with the door code, Lead off'],
  'code-remove': ['People · remove João?', 'Their access ends on their next request.'],
  'code-removing': ['People · removing', 'Removing… held, then he is off'],
  'code-removed': ['People · removed', 'The toast, 17 on the event'],
};

const MAKING: Record<MakeState, readonly [string, string]> = {
  open: ['Making · a new door code', 'Can view first, How many with no default'],
  blank: ['Making · left blank', 'Enter how many people can use this code.'],
  malformed: ['Making · with 3000', 'Use a whole number from 1 to 500.'],
  ends: ['Making · ends earlier', 'The Ends sheet, a day and a time'],
  past: ['Making · an end that has passed', 'Choose a time that hasn’t passed yet.'],
  making: ['Making · making', 'Making… held, then the card'],
  failed: ['Making · failed', 'The line at the top; Make tries again'],
};

const HOLDING: Record<HoldState, readonly [string, string]> = {
  open: ['Hold it up', 'The QR and the code, full screen'],
  counted: ['Hold it up · someone joins', 'The count goes to 15, said once'],
  'new-ask': ['Hold it up · make a new code?', 'Everyone already in stays'],
  new: ['Hold it up · the new code', 'H3WD 9RN6, 0 of 30'],
  'stop-ask': ['Hold it up · stop this code?', 'Nobody new can use it'],
  stopping: ['Hold it up · stopping', 'Stopping… held, then Stopped'],
  'stop-failed': ['Hold it up · stopping failed', 'The Ask stays, so it still works'],
};

const JOINING: Record<RedeemState, readonly [string, string]> = {
  welcome: ['Joining · the welcome', 'Enter a join code under its choices'],
  camera: ['Joining · the camera', 'Its chip opens the app on the event'],
  enter: ['Joining · enter a join code', 'Q7KM 4XP2, any case, spaces ignored'],
  'enter-blank': ['Joining · left blank', 'Enter the join code.'],
  'enter-short': ['Joining · too short', 'A join code is 8 letters and numbers.'],
  checking: ['Joining · checking', 'Continue turns, held, then the event'],
  refused: ['Joining · refused', 'One answer for wrong, expired or stopped'],
  'too-many': ['Joining · too many tries', 'Try again at 13:32'],
  event: ['Joining · the event, then a name', 'The event first, then name and number'],
  'event-blank': ['Joining · send code, left blank', 'Enter your full name.'],
  'event-short': ['Joining · a number too short', 'Too short for Portugal'],
  sending: ['Joining · sending', 'Send code turns, held, then the code'],
  'join-as': ['Joining · already signed in', 'Join as Kemi Okafor'],
  member: ['Joining · already a member', 'Open Events, no grant'],
  code: ['Joining · check WhatsApp', 'The app’s phone step'],
  'code-texted': ['Joining · texted instead', 'Check your messages'],
  'code-wrong': ['Joining · a wrong code', 'Shakes once, the app’s words'],
  'code-expired': ['Joining · an expired code', 'Send a new code'],
  'code-exhausted': ['Joining · too many wrong tries', 'Send a new code'],
  'code-failed': ['Joining · it did not go', 'No connection; nothing lost'],
  'used-up': ['Joining · used up', 'The one refusal after the phone code'],
  in: ['Joining · you’re in', 'Open the event'],
  'event-in': ['Inside the event · can check guests in', 'Check guests in on its card'],
  'event-in-view': ['Inside the event · can view', 'The same card with no step'],
  'people-in': ['Inside the event · People', 'Read only, as João reads it'],
};

function boards<S extends string>(
  table: Record<S, readonly [string, string]>,
  href: (state: S) => string,
): { title: string; what: string; href: string }[] {
  return (Object.keys(table) as S[]).map((state) => ({
    title: table[state][0],
    what: table[state][1],
    href: href(state),
  }));
}

/** The demo home's Door code group: every app state the spec names, deep-linked. */
export const DOOR_CODE_BOARDS = [
  ...boards(PEOPLE, (state) => `/demo/people?state=${state}`),
  ...boards(MAKING, (state) => `/demo/people?code=${state}`),
  ...boards(HOLDING, (state) => `/demo/people?hold=${state}`),
  ...boards(JOINING, (state) => `/demo/redeem?state=${state}`),
];
