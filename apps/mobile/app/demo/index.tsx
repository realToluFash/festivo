import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '../../src/components/Text.tsx';
import { DemoScreen, NavBar } from '../../src/demo/DemoScreen.tsx';
import { Heading } from '../../src/demo/Lines.tsx';
import { SAMPLE } from '../../src/demo/samples.ts';
import { tokens } from '../../src/theme/tokens.ts';

interface Board {
  title: string;
  what: string;
  href: Href;
}

/** Every board in the design artifact, by its page, working on sample data. */
const PAGES: readonly { page: string; boards: readonly Board[] }[] = [
  {
    page: 'Today · where signing in lands',
    boards: [
      { title: 'A planning day', what: 'Four things need you', href: '/demo/today' },
      {
        title: 'A planning day · built now',
        what: 'Only what the events’ dates can say',
        href: '/demo/today?moment=planNow',
      },
      { title: 'The event day', what: 'The cover is Now', href: '/demo/today?moment=day' },
      {
        title: 'The event day · built now',
        what: 'The dates, and Open the event',
        href: '/demo/today?moment=dayNow',
      },
      { title: 'A quiet week', what: 'Nothing due, nothing on', href: '/demo/today?moment=quiet' },
      { title: 'A first run', what: 'No events yet', href: '/demo/today?moment=first' },
    ],
  },
  {
    page: 'Settings · B Confetti',
    boards: [
      {
        title: 'Settings',
        what: 'You as a Confetti card, rows with a tile',
        href: '/demo/settings',
      },
      {
        title: 'Settings · a member',
        what: 'Priya: her own sections and Sign-in rules',
        href: '/demo/settings?as=member',
      },
      {
        title: 'Settings · no organisation',
        what: 'Only your own sections',
        href: '/demo/settings?as=noOrg',
      },
      {
        title: 'Your account',
        what: 'You on the card, what is left to verify',
        href: '/demo/settings/account',
      },
      {
        title: 'Your account · name',
        what: 'Cancel · Name · Save',
        href: '/demo/settings/account?state=name',
      },
      {
        title: 'Your account · make primary?',
        what: 'The Ask on a verified address',
        href: '/demo/settings/account?state=promote',
      },
      {
        title: 'Your account · confirm it’s you',
        what: 'Password and code, after the Ask',
        href: '/demo/settings/account?state=confirm',
      },
      {
        title: 'Your account · remove?',
        what: 'The Ask on a verified address',
        href: '/demo/settings/account?state=remove',
      },
      {
        title: 'Your account · add an email address',
        what: 'Only the primary held',
        href: '/demo/settings/account?state=addEmail',
      },
      {
        title: 'Your account · add a phone number',
        what: 'The country, then the number',
        href: '/demo/settings/account?state=addPhone',
      },
      {
        title: 'Your account · time zone',
        what: 'San typed, the matches under it',
        href: '/demo/settings/account?state=zone',
      },
      {
        title: 'Your account · check your email',
        what: 'The code for the second address',
        href: '/demo/settings/account?state=verifyEmail',
      },
      {
        title: 'Your account · a wrong code',
        what: '482170 refused on the field',
        href: '/demo/settings/account?state=verifyEmailWrong',
      },
      {
        title: 'Your account · an expired code',
        what: 'Send a new code in its place',
        href: '/demo/settings/account?state=verifyEmailExpired',
      },
      {
        title: 'Your account · email verified',
        what: 'The card says so',
        href: '/demo/settings/account?state=verifyEmailDone',
      },
      {
        title: 'Your account · check your messages',
        what: 'A second number, on WhatsApp',
        href: '/demo/settings/account?state=verifyPhone',
      },
      {
        title: 'Your account · an expired text',
        what: 'The second number’s code expired',
        href: '/demo/settings/account?state=verifyPhoneExpired',
      },
      {
        title: 'Your account · number verified',
        what: 'Both numbers verified',
        href: '/demo/settings/account?state=verifyPhoneDone',
      },
      { title: 'Security', what: 'Ways in, two-factor, devices', href: '/demo/settings/security' },
      {
        title: 'Security · Google only',
        what: 'The only way in, no password',
        href: '/demo/settings/security?state=googleOnly',
      },
      {
        title: 'Security · kept by a rule',
        what: 'Google and two-factor stay on',
        href: '/demo/settings/security?state=keptByRule',
      },
      {
        title: 'Security · change password',
        what: 'Current and new, the one rule',
        href: '/demo/settings/security?state=changePassword',
      },
      {
        title: 'Security · set a password',
        what: 'A code by email first',
        href: '/demo/settings/security?state=setPassword',
      },
      {
        title: 'Security · an expired code',
        what: 'Set a password’s emailed code expired',
        href: '/demo/settings/security?state=setPasswordExpired',
      },
      {
        title: 'Security · link Apple',
        what: 'Confirm it’s you, then Apple',
        href: '/demo/settings/security?state=link',
      },
      {
        title: 'Security · link Google or Apple',
        what: 'Password only; you pick which to link',
        href: '/demo/settings/security?state=linkPick',
      },
      {
        title: 'Security · unlink Google?',
        what: 'The Ask over the opened row',
        href: '/demo/settings/security?state=unlink',
      },
      {
        title: 'Security · set up two-factor',
        what: 'The QR, the key, the app’s code',
        href: '/demo/settings/security?state=setup',
      },
      {
        title: 'Security · recovery codes',
        what: 'Saved once; Finish waits for the box',
        href: '/demo/settings/security?state=recovery',
      },
      {
        title: 'Security · new codes?',
        what: 'The Ask over Recovery codes',
        href: '/demo/settings/security?state=newCodes',
      },
      {
        title: 'Security · turn off two-factor?',
        what: 'The Ask over Authenticator app',
        href: '/demo/settings/security?state=turnOff',
      },
      {
        title: 'Security · sign out a device?',
        what: 'Safari on macOS, no proof',
        href: '/demo/settings/security?state=signOutDevice',
      },
      {
        title: 'Security · everywhere else?',
        what: 'Then your password and a code',
        href: '/demo/settings/security?state=everywhere',
      },
      {
        title: 'Security · reset your password',
        what: 'From Forgot it?',
        href: '/demo/settings/security?state=forgot',
      },
      {
        title: 'Security · reset sent',
        what: 'Check your email, Done',
        href: '/demo/settings/security?state=forgotSent',
      },
      {
        title: 'Notifications',
        what: 'How you hear, a row per kind',
        href: '/demo/settings/notifications',
      },
      {
        title: 'Notifications · push blocked',
        what: 'Struck bell, Open device settings',
        href: '/demo/settings/notifications?state=pushBlocked',
      },
      {
        title: 'Notifications · saving',
        what: 'Messages email off, Saving…',
        href: '/demo/settings/notifications?state=saving',
      },
      {
        title: 'Notifications · saved',
        what: 'Messages email off, Saved',
        href: '/demo/settings/notifications?state=saved',
      },
      {
        title: 'Notifications · a save fails',
        what: 'The switch goes back, with the error',
        href: '/demo/settings/notifications?state=saveFailed',
      },
      {
        title: 'Notifications · loading',
        what: 'The card and rows’ shapes, then the page',
        href: '/demo/settings/notifications?state=loading',
      },
      {
        title: 'Notifications · failed',
        what: 'Could not be loaded, Try again',
        href: '/demo/settings/notifications?state=failed',
      },
      {
        title: 'Organisation',
        what: 'Details, joining, ownership',
        href: '/demo/settings/organisation',
      },
      {
        title: 'Organisation · cards loading',
        what: 'Domains loading, the link failed',
        href: '/demo/settings/organisation?state=cardsLoading',
      },
      {
        title: 'Organisation · the only owner',
        what: 'Leave asks you to transfer first',
        href: '/demo/settings/organisation?state=onlyOwner',
      },
      { title: 'Members', what: 'Requests, people, roles', href: '/demo/settings/members' },
      {
        title: 'Members · read only',
        what: 'Somebody who cannot manage members',
        href: '/demo/settings/members?state=readOnly',
      },
      {
        title: 'Members · your own page',
        what: 'Julien, an admin, cannot change his own role',
        href: '/demo/settings/members?state=self',
      },
      {
        title: 'Members · your own page as the owner',
        what: 'Folake hands ownership over in Organisation',
        href: '/demo/settings/members?state=selfOwner',
      },
      {
        title: 'Members · the owner claim',
        what: 'Julien claims Ire Events by its domain',
        href: '/demo/settings/members?state=claim',
      },
      {
        title: 'Members · loading',
        what: 'Loading members',
        href: '/demo/settings/members?state=loading',
      },
      {
        title: 'Members · failed',
        what: 'Could not load, Try again',
        href: '/demo/settings/members?state=failed',
      },
      {
        title: 'Sign-in rules',
        what: 'Julien meets every rule',
        href: '/demo/settings/sign-in-rules',
      },
      {
        title: 'Sign-in rules · two-factor needs you',
        what: 'Julien without two-factor',
        href: '/demo/settings/sign-in-rules?state=twoFactorDue',
      },
      {
        title: 'Sign-in rules · doesn’t apply',
        what: 'Priya is a member',
        href: '/demo/settings/sign-in-rules?state=notYours',
      },
      {
        title: 'Sign-in rules · two-factor for everyone',
        what: 'A deadline, and a new change',
        href: '/demo/settings/sign-in-rules?state=everyone',
      },
      {
        title: 'Sign-in rules · Google or Apple only',
        what: 'Ana signs in with a password',
        href: '/demo/settings/sign-in-rules?state=googleOnly',
      },
      {
        title: 'Sign-in rules · a new change',
        what: 'One change not seen yet',
        href: '/demo/settings/sign-in-rules?state=newChange',
      },
      {
        title: 'Sign-in rules · no changes yet',
        what: 'The rules every organisation starts with',
        href: '/demo/settings/sign-in-rules?state=noChanges',
      },
      {
        title: 'Sign-in rules · loading',
        what: 'Loading the rules',
        href: '/demo/settings/sign-in-rules?state=loading',
      },
      {
        title: 'Sign-in rules · failed',
        what: 'Could not load, Try again',
        href: '/demo/settings/sign-in-rules?state=failed',
      },
    ],
  },
  {
    page: 'Events · A Summary first',
    boards: [
      { title: 'Events', what: 'Upcoming, the soonest as the card', href: '/demo/events' },
      { title: 'Events · drafts', what: 'Drafts, newest first', href: '/demo/events?state=drafts' },
      { title: 'Events · past', what: 'Past, ten at a time', href: '/demo/events?state=past' },
      {
        title: 'Events · past, more shown',
        what: 'After Show more',
        href: '/demo/events?state=pastMore',
      },
      {
        title: 'Events · searching',
        what: '“lucia”, across every tab',
        href: '/demo/events?state=search',
      },
      {
        title: 'Events · filtered',
        what: 'Weddings and birthdays',
        href: '/demo/events?state=filtered',
      },
      {
        title: 'Events · the Filter menu',
        what: 'Type, When and Hosted by',
        href: '/demo/events?state=filterOpen',
      },
      {
        title: 'Events · no match',
        what: 'Search and a filter, both to clear',
        href: '/demo/events?state=noMatch',
      },
      {
        title: 'Events · offline',
        what: 'As of 09:32, Try again',
        href: '/demo/events?state=offline',
      },
      { title: 'Events · a first run', what: 'No events yet', href: '/demo/events?state=first' },
      {
        title: 'An event · draft',
        what: 'Make live is the step',
        href: '/demo/events/evt-draft-4?state=draft',
      },
      {
        title: 'An event · draft, dates gone',
        what: 'Change the dates',
        href: '/demo/events/evt-shower-2?state=draftPast',
      },
      { title: 'An event · live', what: 'The wedding, in 2 days', href: '/demo/events/evt-wed-4' },
      {
        title: 'An event · happening now',
        what: 'Day 2 of 3',
        href: '/demo/events/evt-wed-4?state=now',
      },
      {
        title: 'An event · paused',
        what: 'Resume is the step',
        href: '/demo/events/evt-party-2?state=paused',
      },
      {
        title: 'An event · finished',
        what: 'Duplicate is the step',
        href: '/demo/events/evt-wed-4?state=finished',
      },
      {
        title: 'An event · called off',
        what: 'Nothing to do but duplicate',
        href: '/demo/events/evt-off?state=calledOff',
      },
      {
        title: 'An event · your photo',
        what: 'The cover is a photo',
        href: '/demo/events/evt-wed-4?state=photo',
      },
      {
        title: 'An event · More',
        what: 'The areas the tab bar has no room for',
        href: '/demo/events/evt-wed-4?state=more',
      },
      {
        title: 'An event · Guests',
        what: 'Guests is coming',
        href: '/demo/events/evt-wed-4?area=guests',
      },
      {
        title: 'An event · Budget',
        what: 'Budget is coming',
        href: '/demo/events/evt-wed-4?area=budget',
      },
      {
        title: 'Dates',
        what: 'Start, end and time zone',
        href: '/demo/events/evt-wed-4?state=dates',
      },
      {
        title: 'Dates · changed',
        what: 'The end moved with the start',
        href: '/demo/events/evt-wed-4?state=datesChanged',
      },
      {
        title: 'Dates · ends before it starts',
        what: 'The end, in red',
        href: '/demo/events/evt-wed-4?state=datesError',
      },
      {
        title: 'Dates · discard?',
        what: 'Discard your change?',
        href: '/demo/events/evt-wed-4?state=discard',
      },
      {
        title: 'Dates · changed elsewhere',
        what: 'Show the latest',
        href: '/demo/events/evt-wed-4?state=changedElsewhere',
      },
      {
        title: 'Dates · show the latest?',
        what: 'The Ask before your change goes',
        href: '/demo/events/evt-wed-4?state=showLatest',
      },
      { title: 'Venue', what: 'Name and address', href: '/demo/events/evt-wed-4?state=venue' },
      {
        title: 'Venue · suggestions',
        what: 'From three letters',
        href: '/demo/events/evt-wed-4?state=venueSuggestions',
      },
      {
        title: 'Venue · another time zone',
        what: 'Use the venue’s, or keep',
        href: '/demo/events/evt-wed-4?state=venueZone',
      },
      {
        title: 'Venue · suggestions down',
        what: 'Type it in full',
        href: '/demo/events/evt-wed-4?state=venueDown',
      },
      {
        title: 'Hosted by',
        what: 'The hosts, in order',
        href: '/demo/events/evt-wed-4?state=hosts',
      },
      {
        title: 'Hosted by · a name twice',
        what: 'The second, in red',
        href: '/demo/events/evt-wed-4?state=hostsDuplicate',
      },
      {
        title: 'Hosted by · six',
        what: 'The most an event has',
        href: '/demo/events/evt-wed-4?state=hostsSix',
      },
      {
        title: 'Hosted by · the last host',
        what: 'Nothing to remove',
        href: '/demo/events/evt-party-2?state=lastHost',
      },
      { title: 'Type', what: 'One of the types', href: '/demo/events/evt-wed-4?state=type' },
      {
        title: 'Currency',
        what: 'One of the currencies',
        href: '/demo/events/evt-wed-4?state=currency',
      },
      {
        title: 'Currency · refused',
        what: 'Prices are set',
        href: '/demo/events/evt-wed-4?state=currencyRefused',
      },
      {
        title: 'Event name',
        what: 'The name, with its count',
        href: '/demo/events/evt-wed-4?state=name',
      },
      {
        title: 'Event name · blank',
        what: 'The name, in red',
        href: '/demo/events/evt-wed-4?state=nameBlank',
      },
      {
        title: 'Cover',
        what: 'Soirely’s cover, in its own colours',
        href: '/demo/events/evt-wed-4?state=cover',
      },
      {
        title: 'Cover · refused',
        what: 'The photo could not be used',
        href: '/demo/events/evt-wed-4?state=coverRefused',
      },
      {
        title: 'Cover · your photo',
        what: 'Position and a description',
        href: '/demo/events/evt-wed-4?state=coverPhoto',
      },
      {
        title: 'Pause?',
        what: 'The Ask on a live event',
        href: '/demo/events/evt-wed-4?state=pause',
      },
      {
        title: 'Call off?',
        what: 'The Ask before it starts',
        href: '/demo/events/evt-party-2?state=callOff',
      },
      {
        title: 'End now?',
        what: 'The Ask while it is on',
        href: '/demo/events/evt-wed-4?state=endNow',
      },
      {
        title: 'Delete the draft?',
        what: 'The Ask on a draft',
        href: '/demo/events/evt-draft-4?state=deleteDraft',
      },
      { title: 'Delete event', what: 'Type its name', href: '/demo/events/evt-wed-4?state=delete' },
      {
        title: 'Delete event · not the name',
        what: 'The name, in red',
        href: '/demo/events/evt-wed-4?state=deleteMismatch',
      },
      {
        title: 'Delete event · the name',
        what: 'Delete is on',
        href: '/demo/events/evt-wed-4?state=deleteTyped',
      },
      {
        title: 'Duplicate',
        what: 'What is copied, and when it starts',
        href: '/demo/events/evt-wed-4?state=duplicate',
      },
      { title: 'Mute · on', what: 'Just for you', href: '/demo/events/evt-wed-4?state=muted' },
      {
        title: 'Mute · not loaded',
        what: 'Try again',
        href: '/demo/events/evt-wed-4?state=muteNotLoaded',
      },
      {
        title: 'Mute · not saved',
        what: 'The switch holds',
        href: '/demo/events/evt-wed-4?state=muteNotSaved',
      },
    ],
  },
  {
    page: 'People on an event',
    boards: [
      { title: 'People', what: 'One list, the role in a sheet', href: '/demo/people' },
      {
        title: 'People · read only',
        what: 'Ana, who can only read it',
        href: '/demo/people?state=readOnly',
      },
      {
        title: 'People · the lead',
        what: 'Priya leads, and changes it',
        href: '/demo/people?state=lead',
      },
      { title: 'People · nobody yet', what: 'A new event', href: '/demo/people?state=nobody' },
      {
        title: 'People · a role change fails',
        what: 'Saving…, then the role holds',
        href: '/demo/people?state=roleFails',
      },
      {
        title: 'People · loading',
        what: 'Loading the people on this event',
        href: '/demo/people?state=loading',
      },
      {
        title: 'People · failed',
        what: 'Could not load, Try again',
        href: '/demo/people?state=failed',
      },
    ],
  },
  {
    page: 'Sign-in',
    boards: [
      { title: 'Welcome', what: 'The app opens here signed out', href: '/demo/welcome' },
      {
        title: 'Welcome · signed out',
        what: 'After a session ends',
        href: '/demo/welcome?notice=signedOut',
      },
      {
        title: 'Welcome · signed out by a rule',
        what: 'Ire Events signs people out after 30 days',
        href: '/demo/welcome?notice=byRule',
      },
      {
        title: 'Sign in with email',
        what: 'The checks, and the refused shake',
        href: '/demo/sign-in',
      },
    ],
  },
  {
    page: 'Onboarding · a new account',
    boards: [
      {
        title: 'Create an account',
        what: 'Name, email and password, then the codes',
        href: '/demo/create',
      },
      {
        title: 'Create an account · invited',
        what: 'An invitation is waiting',
        href: '/demo/create?after=invited',
      },
      { title: 'Apple, the first time', what: 'Apple didn’t share the name', href: '/demo/apple' },
      {
        title: 'Google, the first time',
        what: 'Two steps',
        href: '/demo/organisation?via=google',
      },
      { title: 'Join link · signed out', what: 'The same choices as welcome', href: '/demo/join' },
      {
        title: 'Join link · signed in',
        what: 'A message of up to 500 characters',
        href: '/demo/join-message',
      },
    ],
  },
  {
    page: 'Onboarding · two-factor',
    boards: [
      { title: 'Enter your code', what: 'The authenticator’s code', href: '/demo/two-factor' },
      {
        title: 'Enter a recovery code',
        what: 'The dash goes in by itself',
        href: '/demo/recovery',
      },
      { title: 'Lost the authenticator', what: 'Email and text', href: '/demo/lost' },
      {
        title: 'Lost the authenticator · email only',
        what: 'No verified mobile',
        href: '/demo/lost?emailOnly=1',
      },
      {
        title: 'Waiting for Ire Events',
        what: 'Answer it from the demo',
        href: '/demo/waiting',
      },
      { title: 'Two-factor is off', what: 'Confirmed', href: '/demo/ending?kind=approved' },
      { title: 'Turned down', what: 'An ending', href: '/demo/ending?kind=turnedDown' },
      { title: 'Ended', what: 'Nobody answered in 7 days', href: '/demo/ending?kind=ended' },
      { title: 'Cancelled', what: 'An ending', href: '/demo/ending?kind=cancelled' },
      { title: 'Replaced', what: 'A newer request', href: '/demo/ending?kind=replaced' },
      {
        title: 'Nobody can confirm',
        what: 'Contact Soirely support',
        href: '/demo/ending?kind=nobody',
      },
      {
        title: 'Set up two-factor again',
        what: 'After getting back in',
        href: '/demo/tfa-again',
      },
    ],
  },
  {
    page: 'Onboarding · the password',
    boards: [
      { title: 'Reset your password', what: 'Carries the email', href: '/demo/reset' },
      {
        title: 'Set a new password',
        what: 'From the link in the email',
        href: '/demo/new-password',
      },
      { title: 'This link has expired', what: 'One button', href: '/demo/link-expired' },
    ],
  },
  {
    page: 'Onboarding · no connection',
    boards: [
      {
        title: 'Cannot reach Soirely · signed out',
        what: 'On the brand',
        href: '/demo/unreachable',
      },
      {
        title: 'Cannot reach Soirely · signed in',
        what: 'Says you still are',
        href: '/demo/unreachable?signedIn=1',
      },
    ],
  },
];

const VALUES = [
  ['Email', SAMPLE.email],
  ['Password', SAMPLE.password],
  ['Codes we send', SAMPLE.code],
  ['Authenticator', SAMPLE.authenticator],
  ['Recovery code', SAMPLE.recovery],
] as const;

function leaveDemo(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export default function DemoHome() {
  return (
    <DemoScreen nav={<NavBar left="close" onLeft={leaveDemo} />}>
      <Heading
        title="Design demo"
        intro="Each board from the design, working on sample data. Nothing here reaches the API."
      />
      <View style={styles.panel}>
        {VALUES.map(([name, value]) => (
          <View key={name} style={styles.value}>
            <Text size={tokens.typeBody.size} style={styles.secondary}>
              {name}
            </Text>
            <Text size={tokens.typeBody.size} weight="semibold" family="mono" selectable>
              {value}
            </Text>
          </View>
        ))}
        <Text size={tokens.typeSmall.size} style={styles.secondary}>
          Anything else is refused, so the errors can be tried.
        </Text>
      </View>
      {PAGES.map(({ page, boards }) => (
        <View key={page} style={styles.page}>
          <Text
            size={tokens.typeSmall.size}
            weight="semibold"
            accessibilityRole="header"
            style={styles.secondary}
          >
            {page.toUpperCase()}
          </Text>
          <View style={styles.list}>
            {boards.map((board, index) => (
              <Pressable
                key={board.title}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.divided,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push(board.href)}
                accessibilityRole="button"
                accessibilityLabel={`${board.title}. ${board.what}`}
                testID={`demo.board.${board.title}`}
              >
                <View style={styles.words}>
                  <Text size={tokens.typeRowTitle.size} weight="semibold" accessible={false}>
                    {board.title}
                  </Text>
                  <Text size={tokens.typeSmall.size} style={styles.secondary} accessible={false}>
                    {board.what}
                  </Text>
                </View>
                <Svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={tokens.colorInkSecondary}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <Path d="m9 6 6 6-6 6" />
                </Svg>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </DemoScreen>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: tokens.space3xl,
    padding: tokens.spaceXl,
    gap: tokens.spaceSm,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  value: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  secondary: { color: tokens.colorInkSecondary },
  page: { marginTop: tokens.space4xl, gap: tokens.spaceSm },
  list: {
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  row: {
    minHeight: tokens.sizeListRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceXl,
    paddingVertical: tokens.spaceMd,
  },
  divided: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  pressed: { backgroundColor: tokens.colorInset },
  words: { flex: 1, gap: 2 },
});
