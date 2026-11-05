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
        title: 'Settings · a planner',
        what: 'Only the sections the role holds',
        href: '/demo/settings?as=planner',
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
        title: 'Notifications',
        what: 'Push and email for each kind',
        href: '/demo/settings/notifications',
      },
      {
        title: 'Notifications · push blocked',
        what: 'Pushes are off on this device',
        href: '/demo/settings/notifications?state=pushBlocked',
      },
      {
        title: 'Notifications · a save fails',
        what: 'The switch goes back, with the error',
        href: '/demo/settings/notifications?state=saveFailed',
      },
      {
        title: 'Notifications · loading',
        what: 'The skeleton, then the grid',
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
      { title: 'Roles', what: 'What each role may do', href: '/demo/settings/roles' },
      {
        title: 'Roles · locked areas',
        what: 'Julien cannot give what he lacks',
        href: '/demo/settings/roles?state=locked',
      },
      {
        title: 'Roles · loading',
        what: 'Loading the roles',
        href: '/demo/settings/roles?state=loading',
      },
      {
        title: 'Roles · failed',
        what: 'Could not load, Try again',
        href: '/demo/settings/roles?state=failed',
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
        what: 'Priya is not a manager',
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
