import { type Href, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '../../src/components/Text.tsx';
import { DemoScreen, NavBar } from '../../src/demo/DemoScreen.tsx';
import { BOLD_TEXT_BOARDS } from '../../src/demo/boldText/BoldTextBoards.ts';
import { BUDGET_BOARDS } from '../../src/demo/budget/BudgetBoards.ts';
import { DATA_BOARDS } from '../../src/demo/settings/DataBoards.ts';
import { Heading } from '../../src/steps/Lines.tsx';
import { SAMPLE } from '../../src/demo/samples.ts';
import { DOOR_CODE_BOARDS } from '../../src/demo/doorCode/DoorCodeBoards.ts';
import { GUESTS_BOARDS } from '../../src/demo/guests/GuestsBoards.ts';
import { PASS_BOARDS } from '../../src/demo/pass/PassBoards.ts';
import { MESSAGES_BOARDS } from '../../src/demo/messages/MessagesBoards.ts';
import { SEATING_BOARDS } from '../../src/demo/seating/SeatingBoards.ts';
import { tokens } from '../../src/theme/tokens.ts';

interface Board {
  title: string;
  what: string;
  href: Href;
}

/** Every board in the design artifact, by its page, working on sample data. */
const PAGES: readonly { page: string; boards: readonly Board[] }[] = [
  {
    page: 'Bold text · the weight map',
    boards: BOLD_TEXT_BOARDS.map(({ title, what, href }) => ({ title, what, href: href as Href })),
  },
  {
    page: 'Today · where signing in lands',
    boards: [
      { title: 'A planning day', what: 'Four things need you', href: '/demo/today' },
      {
        title: 'A planning day · invitations not sent',
        what: 'The party with nobody invited',
        href: '/demo/today?moment=plan&invites=none',
      },
      {
        title: 'Needs you · every overdue form',
        what: 'Overdue, 1 day overdue, 2 days overdue, at 23:59',
        href: '/demo/today?needs=overdue',
      },
      {
        title: 'Needs you · one thing',
        what: 'One row, due today',
        href: '/demo/today?needs=one',
      },
      {
        title: 'Needs you · nothing',
        what: 'The tick, and no line on the cover',
        href: '/demo/today?needs=none',
      },
      {
        title: 'Needs you · a long title',
        what: 'It wraps, and the date never shortens',
        href: '/demo/today?needs=long',
      },
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
      {
        title: 'The event day · guests arriving',
        what: '87/99 arrived, beside Open the event',
        href: '/demo/today?moment=dayNow&arrived=some',
      },
      {
        title: 'The event day · nobody Coming',
        what: '37 arrived, no ring and no bar',
        href: '/demo/today?moment=dayNow&arrived=nobodyComing',
      },
      {
        title: 'The event day · four-digit figures',
        what: '1,204 of 1,250, in the phone’s own numbers',
        href: '/demo/today?moment=dayNow&arrived=thousands',
      },
      {
        title: 'The event day · four digits in French',
        what: '1 204 of 1 250; try the iPhone SE',
        href: '/demo/today?moment=dayNow&arrived=thousands&numbers=fr-FR',
      },
      {
        title: 'The event day · nobody arrived yet',
        what: 'Day 1 at 15:20: the replies line, no figure',
        href: '/demo/today?moment=dayNow&arrived=none',
      },
      {
        title: 'The event day · arrivals coming in',
        what: 'Day 1 from 16:05: to 3 of 98 and back, every 4 seconds',
        href: '/demo/today?moment=dayNow&arrived=live',
      },
      {
        title: 'Now · from the run of show',
        what: 'Drinks, until 17:30, 10 min behind',
        href: '/demo/today?moment=day&now=on',
      },
      {
        title: 'Now · over its length',
        what: '12 min over, 22 min behind',
        href: '/demo/today?moment=day&now=over',
      },
      {
        title: 'Now · no length',
        what: 'Speeches, no until line, On time',
        href: '/demo/today?moment=day&now=open',
      },
      {
        title: 'Now · the last item',
        what: 'Last item under way, no Next',
        href: '/demo/today?moment=day&now=last',
      },
      {
        title: 'Now · nothing is on',
        what: 'Between two items, with Next',
        href: '/demo/today?moment=day&now=between',
      },
      {
        title: 'Now · before the first',
        what: 'Nothing is on, On time',
        href: '/demo/today?moment=day&now=before',
      },
      {
        title: 'Now · that’s everything',
        what: 'No Next and no figure',
        href: '/demo/today?moment=day&now=done',
      },
      {
        title: 'Now · a 120-character title',
        what: 'It wraps; try the iPhone SE',
        href: '/demo/today?moment=day&now=long',
      },
      {
        title: 'Now · nobody arrived yet',
        what: 'Next alone on its row, no figure',
        href: '/demo/today?moment=day&now=on&arrived=none',
      },
      {
        title: 'Now · nobody Coming',
        what: '37 arrived beside Next, no ring',
        href: '/demo/today?moment=day&now=on&arrived=nobodyComing',
      },
      {
        title: 'Now · four-digit figures',
        what: '1,204/1,250 beside Next; try the iPhone SE',
        href: '/demo/today?moment=day&now=on&arrived=thousands',
      },
      { title: 'A quiet week', what: 'Nothing due, nothing on', href: '/demo/today?moment=quiet' },
      { title: 'A first run', what: 'No events yet', href: '/demo/today?moment=first' },
    ],
  },
  {
    page: 'Create an organisation · B · A short walk',
    boards: [
      {
        title: 'The way in · the switcher',
        what: 'Ire Events, then Create an organisation',
        href: '/demo/today?switcher=one',
      },
      {
        title: 'The way in · no organisation',
        what: 'Start organisation opens the walk',
        href: '/demo/today?orgs=none',
      },
      {
        title: 'Step 1 · nothing typed',
        what: 'The dashed plus, the keys up',
        href: '/demo/today?create=name',
      },
      {
        title: 'Step 1 · typing',
        what: 'LF in Tint, no colour yet',
        href: '/demo/today?create=typing',
      },
      {
        title: 'Step 1 · continue with nothing',
        what: 'Main’s reason under the field',
        href: '/demo/today?create=name-blank',
      },
      {
        title: 'Step 1 · over 100',
        what: '118 characters, with the count',
        href: '/demo/today?create=name-long',
      },
      {
        title: 'Step 1 · refused on Create',
        what: 'The server’s reason under the name',
        href: '/demo/today?create=name-refused',
      },
      {
        title: 'Step 2 · the device’s country',
        what: 'Portugal picked, what it brings',
        href: '/demo/today?create=country',
      },
      {
        title: 'Step 2 · the list, scrolled',
        what: 'All countries pinned, Portugal ticked',
        href: '/demo/today?create=country-list',
      },
      {
        title: 'Step 2 · searching',
        what: '“bra”: three countries',
        href: '/demo/today?create=country-search',
      },
      {
        title: 'Step 2 · another country',
        what: 'Brazil picked, the zone still Lisbon',
        href: '/demo/today?create=country-picked',
      },
      {
        title: 'Step 2 · no country',
        what: 'A device that names none',
        href: '/demo/today?create=country-none',
      },
      {
        title: 'Step 3 · ready',
        what: 'The card, the intro and the defaults',
        href: '/demo/today?create=ready',
      },
      {
        title: 'Step 3 · creating',
        what: 'Creating… held, then lands',
        href: '/demo/today?create=creating',
      },
      {
        title: 'Step 3 · too many for now',
        what: 'Try again at 10:41',
        href: '/demo/today?create=limited',
      },
      {
        title: 'Step 3 · did not work',
        what: 'Create organisation tries again',
        href: '/demo/today?create=failed',
      },
      {
        title: 'Landed in its Today',
        what: 'Now working in Lumen Feiras',
        href: '/demo/today?create=created',
      },
      {
        title: 'The switcher, afterwards',
        what: 'Lumen Feiras in its colour, current',
        href: '/demo/today?create=created&switcher=one',
      },
      {
        title: 'Back on step 2',
        what: 'Step 1 as it was left, keys down',
        href: '/demo/today?create=back-name',
      },
      {
        title: 'Back on step 3',
        what: 'Brazil kept, the list at Brazil',
        href: '/demo/today?create=back-country',
      },
      {
        title: 'Cancel, with something entered',
        what: 'Discard this organisation?',
        href: '/demo/today?create=discard',
      },
      {
        title: 'From no organisation · typing',
        what: 'The same walk, the other way in',
        href: '/demo/today?orgs=none&create=typing',
      },
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
        title: 'Your account · add a phone number · no country',
        what: 'The Code starts blank: Choose a country.',
        href: '/demo/settings/account?state=addPhoneNoCountry',
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
        title: 'Personalisation',
        what: 'Never chosen: Violet, Choose colours',
        href: '/demo/settings/personalisation',
      },
      {
        title: 'Personalisation · after a choice',
        what: 'Garden, Violet is Soirely’s own',
        href: '/demo/settings/personalisation?state=chosen',
      },
      {
        title: 'Settings · in Garden',
        what: 'Personalisation’s tile in your colours',
        href: '/demo/settings?scheme=garden',
      },
      {
        title: 'Personalisation · Colours',
        what: 'Violet current, Save waits',
        href: '/demo/settings/personalisation?state=colours',
      },
      {
        title: 'Personalisation · Garden picked',
        what: 'The card in Garden, Not saved yet',
        href: '/demo/settings/personalisation?state=picked',
      },
      {
        title: 'Personalisation · saving',
        what: 'Saving…, the swatches wait',
        href: '/demo/settings/personalisation?state=saving',
      },
      {
        title: 'Personalisation · saved',
        what: 'Back on the page in Garden, Saved',
        href: '/demo/settings/personalisation?state=saved',
      },
      {
        title: 'Personalisation · a save fails',
        what: 'The reason in red, Try again',
        href: '/demo/settings/personalisation?state=saveFailed',
      },
      {
        title: 'Personalisation · offline',
        what: 'Not saved because you are offline',
        href: '/demo/settings/personalisation?state=offline',
      },
      {
        title: 'Personalisation · loading',
        what: 'The card’s shape, then the page',
        href: '/demo/settings/personalisation?state=loading',
      },
      {
        title: 'Personalisation · failed',
        what: 'Your colours did not load, Try again',
        href: '/demo/settings/personalisation?state=failed',
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
        title: 'Organisation · no currency',
        what: 'Never chosen: Choose a currency.',
        href: '/demo/settings/organisation?state=currencyBlank',
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
        title: 'Members · requests to get back in',
        what: 'Kofi and Priya lost their two-factor',
        href: '/demo/settings/members?state=recovery',
      },
      {
        title: 'Members · requests to get back in as Julien',
        what: 'The same, as Julien, an admin',
        href: '/demo/settings/members?state=recovery&as=julien',
      },
      {
        title: 'Members · approve a request to get back in',
        what: 'Turn off Kofi Mensah’s two-factor?',
        href: '/demo/settings/members?state=recoveryApprove',
      },
      {
        title: 'Members · turn down a request to get back in',
        what: 'Turn down Kofi Mensah’s request?',
        href: '/demo/settings/members?state=recoveryTurnDown',
      },
      {
        title: 'Members · a request to get back in approved',
        what: 'Kofi’s two-factor is off, Answer Priya Shah',
        href: '/demo/settings/members?state=recoveryApproved',
      },
      {
        title: 'Members · a request to get back in turned down',
        what: 'Kofi’s request is turned down, Answer Priya Shah',
        href: '/demo/settings/members?state=recoveryTurnedDown',
      },
      {
        title: 'Members · a request answered elsewhere',
        what: 'Kofi’s confirm offers Close alone',
        href: '/demo/settings/members?state=recoveryClosed',
      },
      {
        title: 'Members · an answer on its way',
        what: 'Sending your answer…, the way back waits',
        href: '/demo/settings/members?state=recoverySending',
      },
      {
        title: 'Members · an answer that failed',
        what: 'That did not work, the verb tries again',
        href: '/demo/settings/members?state=recoveryFailed',
      },
      {
        title: 'Members · no request to get back in left',
        what: 'Both answered, Answer Lucía Gómez',
        href: '/demo/settings/members?state=recoveryDone',
      },
      {
        title: 'Members · your own request to get back in',
        what: 'Julien’s, which somebody else answers',
        href: '/demo/settings/members?state=recoveryOwn&as=julien',
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
    page: 'Data and control · B · One place',
    boards: DATA_BOARDS.map(({ title, what, href }) => ({ title, what, href: href as Href })),
  },
  {
    page: 'Members · handing over · A One person',
    boards: [
      {
        title: 'Removing · the Ask',
        what: 'Priya leads 3 events, starting on you',
        href: '/demo/settings/members?state=handover',
      },
      {
        title: 'Removing · the menu',
        what: 'Active members, never Priya or Marta',
        href: '/demo/settings/members?state=handoverMenu',
      },
      {
        title: 'Removing · someone picked',
        what: 'Ana Souza takes them',
        href: '/demo/settings/members?state=handoverPicked',
      },
      {
        title: 'Removing · a long list',
        what: 'Julien leads 8: five, then and 3 more',
        href: '/demo/settings/members?state=handoverLong',
      },
      {
        title: 'Removing · one event',
        what: 'Priya leads 1 event: Hand it to',
        href: '/demo/settings/members?state=handoverOne',
      },
      {
        title: 'Removing · a long name',
        what: 'Cut to one line; Team offsite, called off, looks the same',
        href: '/demo/settings/members?state=handoverLongNames',
      },
      {
        title: 'Removing · the work list loading',
        what: 'Keep Priya only: nothing to confirm yet',
        href: '/demo/settings/members?state=handoverLoading',
      },
      {
        title: 'Removing · the work list failed',
        what: 'Try again, no Remove',
        href: '/demo/settings/members?state=handoverLoadFailed',
      },
      {
        title: 'Removing · refused',
        what: 'Tom began leading while it stood open',
        href: '/demo/settings/members?state=handoverRefused',
      },
      {
        title: 'Removing · the menu’s search',
        what: '18 members, “jo” finds 3',
        href: '/demo/settings/members?state=handoverSearch',
      },
      {
        title: 'Removing · nobody matches',
        what: '“kemi”, Clear search',
        href: '/demo/settings/members?state=handoverSearchNobody',
      },
      {
        title: 'Removing · no events',
        what: 'Tom leads nothing: today’s Ask',
        href: '/demo/settings/members?state=removingNoWork',
      },
      {
        title: 'Removing · sending',
        what: 'Removing…, off',
        href: '/demo/settings/members?state=handoverSending',
      },
      {
        title: 'Removing · failed',
        what: 'Removing did not work',
        href: '/demo/settings/members?state=handoverFailed',
      },
      {
        title: 'Removing · done',
        what: 'The card says who leads them now',
        href: '/demo/settings/members?state=handoverDone',
      },
      {
        title: 'Leaving · the Ask',
        what: 'Ana leads 2 events, Nobody first',
        href: '/demo/settings/organisation?state=leave&as=member',
      },
      {
        title: 'Leaving · the menu',
        what: 'Nobody, then every active member',
        href: '/demo/settings/organisation?state=leaveMenu&as=member',
      },
      {
        title: 'Leaving · someone picked',
        what: 'Julien Moreau takes them',
        href: '/demo/settings/organisation?state=leavePicked&as=member',
      },
      {
        title: 'Leaving · sending',
        what: 'Leaving…, then Today',
        href: '/demo/settings/organisation?state=leaveSending&as=member',
      },
      {
        title: 'Leaving · failed',
        what: 'Leaving did not work',
        href: '/demo/settings/organisation?state=leaveFailed&as=member',
      },
      {
        title: 'Leaving · no events',
        what: 'Today’s Ask',
        href: '/demo/settings/organisation?state=leaveNoWork&as=member',
      },
      {
        title: 'Leaving · one event',
        what: 'Nobody: the owners take it',
        href: '/demo/settings/organisation?state=leaveOne&as=member',
      },
      {
        title: 'Leaving · the work list loading',
        what: 'Stay only: nothing to confirm yet',
        href: '/demo/settings/organisation?state=leaveLoading&as=member',
      },
      {
        title: 'Leaving · the work list failed',
        what: 'Try again, no Leave',
        href: '/demo/settings/organisation?state=leaveLoadFailed&as=member',
      },
      {
        title: 'A suspended member',
        what: 'Marta leads 2 events, Hand over now',
        href: '/demo/settings/members?state=marta',
      },
      {
        title: 'A suspended member · one event',
        what: 'Marta leads 1 event',
        href: '/demo/settings/members?state=martaOne',
      },
      {
        title: 'A suspended member · the work list loading',
        what: 'No Hand over now yet',
        href: '/demo/settings/members?state=martaLoading',
      },
      {
        title: 'A suspended member · the work list failed',
        what: 'Try again on her page',
        href: '/demo/settings/members?state=martaLoadFailed',
      },
      {
        title: 'Hand over now · the Ask',
        what: 'Cancel, Hand over in Violet',
        href: '/demo/settings/members?state=handoverNow',
      },
      {
        title: 'Hand over now · sending',
        what: 'Handing over…, off',
        href: '/demo/settings/members?state=handoverNowSending',
      },
      {
        title: 'Hand over now · failed',
        what: 'Handing over did not work',
        href: '/demo/settings/members?state=handoverNowFailed',
      },
      {
        title: 'Hand over now · done',
        what: 'Marta’s card, the list gone',
        href: '/demo/settings/members?state=handoverNowDone',
      },
      {
        title: 'Hand over now · read only',
        what: 'Julien reads Marta, an owner',
        href: '/demo/settings/members?state=handoverReadOnly',
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
      {
        title: 'Events · loading',
        what: 'The card and rows as shapes, search and Filter off',
        href: '/demo/events?state=loading',
      },
      { title: 'Events · a first run', what: 'No events yet', href: '/demo/events?state=first' },
      {
        title: 'Events · a first run, without Create events',
        what: 'The ask-an-owner notice, no Create an event',
        href: '/demo/events?state=firstAsk',
      },
      {
        title: 'Events · nothing on Upcoming',
        what: 'Events elsewhere, this tab empty',
        href: '/demo/events?state=emptyUpcoming',
      },
      {
        title: 'Events · no drafts',
        what: 'Events elsewhere, this tab empty',
        href: '/demo/events?state=emptyDrafts',
      },
      {
        title: 'Events · nothing on Past',
        what: 'Events elsewhere, this tab empty',
        href: '/demo/events?state=emptyPast',
      },
      {
        title: 'Events · nobody invited yet',
        what: 'The guest counts at 0',
        href: '/demo/events?state=noGuests',
      },
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
      {
        title: 'Needs you · rows',
        what: 'An overdue one first, no button on any row',
        href: '/demo/events/evt-wed-4?state=needsYou',
      },
      {
        title: 'Needs you · one row',
        what: 'Its count at 1',
        href: '/demo/events/evt-wed-4?state=needsYouOne',
      },
      {
        title: 'Needs you · overdue',
        what: 'On the day, 1 day and 2 days, a tie by title',
        href: '/demo/events/evt-wed-4?state=needsYouOverdue',
      },
      {
        title: 'Needs you · a copy recorded',
        what: 'Its row gone',
        href: '/demo/events/evt-wed-4?state=needsYouGiven',
      },
      {
        title: 'Needs you · reads only',
        what: 'A member who only reads the menu',
        href: '/demo/events/evt-wed-4?state=needsYouReadOnly',
      },
      {
        title: 'Needs you · not loaded yet',
        what: 'No row, no count, no tick',
        href: '/demo/events/evt-wed-4?state=needsYouLoading',
      },
      {
        title: 'Needs you · the read failed',
        what: 'No row, no count, no tick',
        href: '/demo/events/evt-wed-4?state=needsYouFailed',
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
        title: 'Dates · onto the reply-by date',
        what: 'Saving moves Reply by too',
        href: '/demo/events/evt-wed-4?state=datesReplyBy',
      },
      {
        title: 'Dates · asks before closing replies',
        what: 'Close replies sooner?',
        href: '/demo/events/evt-wed-4?state=datesReplyByAsk',
      },
      {
        title: 'Dates · Reply by moved',
        what: 'The page again, with the new date',
        href: '/demo/events/evt-wed-4?state=datesReplyBySaved',
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
      {
        title: 'Saved',
        what: 'The page again, with Saved',
        href: '/demo/events/evt-wed-4?state=saved',
      },
      {
        title: 'Reply by',
        what: 'The date replies close (sc-3780)',
        href: '/demo/events/evt-wed-4?state=replyBy',
      },
      {
        title: 'Reply by · none yet',
        what: 'Replies stay open until the start',
        href: '/demo/events/evt-draft-4?state=replyByEmpty',
      },
      {
        title: 'Reply by · on the day it starts',
        what: 'Choose a date before the event starts',
        href: '/demo/events/evt-wed-4?state=replyByError',
      },
      {
        title: 'Reply by · sooner',
        what: 'Close replies sooner?',
        href: '/demo/events/evt-wed-4?state=replyBySooner',
      },
      {
        title: 'Reply by · already past',
        what: 'Close replies now?',
        href: '/demo/events/evt-wed-4?state=replyByNow',
      },
      {
        title: 'Reply by · saved',
        what: 'The page again, with the new date',
        href: '/demo/events/evt-wed-4?state=replyBySaved',
      },
      {
        title: 'Reply by · removed',
        what: 'Replies stay open until the start',
        href: '/demo/events/evt-wed-4?state=replyByRemoved',
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
      {
        title: 'Final numbers due · Next up',
        what: 'Marked You, no action in the app',
        href: '/demo/events/evt-wed-4?state=finalNumbers',
      },
      {
        title: 'Final numbers due · overdue',
        what: 'Still Next up, Overdue',
        href: '/demo/events/evt-wed-4?state=finalNumbersOverdue',
      },
      {
        title: 'Final numbers due · given',
        what: 'A copy recorded: gone',
        href: '/demo/events/evt-wed-4?state=finalNumbersGiven',
      },
      {
        title: 'Give the changes · Next up',
        what: 'Back after a copy, due at the date, no action',
        href: '/demo/events/evt-wed-4?state=changes_due',
      },
      {
        title: 'Give the changes · overdue',
        what: 'The date passed, still not in a copy',
        href: '/demo/events/evt-wed-4?state=changes_overdue',
      },
      {
        title: 'Give the changes · at the start',
        what: 'Back after the date: due at the start',
        href: '/demo/events/evt-wed-4?state=changes_late',
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
    page: 'Door code',
    boards: DOOR_CODE_BOARDS.map(({ title, what, href }) => ({ title, what, href: href as Href })),
  },
  {
    page: 'Budget · A Summary first',
    boards: BUDGET_BOARDS.map(({ title, what, href }) => ({ title, what, href: href as Href })),
  },
  {
    page: 'Messages · B Conversations',
    boards: MESSAGES_BOARDS.map(({ title, what, href }) => ({ title, what, href: href as Href })),
  },
  {
    page: 'Seating · A The room',
    boards: SEATING_BOARDS.map(({ title, what, href }) => ({ title, what, href: href as Href })),
  },
  {
    page: 'Service · the pass’s print controls (sc-4018) · tablet landscape',
    boards: PASS_BOARDS.map(({ title, what, href }) => ({ title, what, href: href as Href })),
  },
  {
    page: 'Guests · A Summary first',
    boards: GUESTS_BOARDS.map(({ title, what, href }) => ({ title, what, href: href as Href })),
  },
  {
    page: 'Calendar · A Weeks as lanes',
    boards: [
      {
        title: 'Calendar',
        what: 'Month, this week, events and milestones',
        href: '/demo/calendar?state=populated',
      },
      {
        title: 'Calendar · Agenda',
        what: 'A list of days, landing on today',
        href: '/demo/calendar?state=agenda',
      },
      {
        title: 'Calendar · the Show menu',
        what: 'Events only, chosen',
        href: '/demo/calendar?state=showMenu',
      },
      {
        title: 'Calendar · events only',
        what: 'No milestones',
        href: '/demo/calendar?state=eventsOnly',
      },
      {
        title: 'Calendar · a busy day',
        what: 'Sat, Nov 14 open, +2 more',
        href: '/demo/calendar?state=busyDay',
      },
      {
        title: 'Calendar · the month’s edge',
        what: 'A reunion runs into December',
        href: '/demo/calendar?state=monthEdge',
      },
      {
        title: 'Calendar · another time zone',
        what: 'Sat, Oct 10 open',
        href: '/demo/calendar?state=otherZone',
      },
      {
        title: 'Calendar · an empty month',
        what: 'February 2027',
        href: '/demo/calendar?state=emptyMonth',
      },
      {
        title: 'Calendar · no events',
        what: 'The first run, Subscribe kept',
        href: '/demo/calendar?state=none',
      },
      {
        title: 'Calendar · loading',
        what: 'The weeks in Sunk',
        href: '/demo/calendar?state=loading',
      },
      {
        title: 'Calendar · failed',
        what: 'Could not load, Try again',
        href: '/demo/calendar?state=failed',
      },
      {
        title: 'Calendar · Subscribe',
        what: 'Your private link',
        href: '/demo/calendar?state=subscribe',
      },
      {
        title: 'Calendar · copy refused',
        what: 'Press and hold the link',
        href: '/demo/calendar?state=subscribeRefused',
      },
      {
        title: 'Calendar · reset your link?',
        what: 'Reset link, or keep it',
        href: '/demo/calendar?state=resetLink',
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
        title: 'Welcome · Terms pressed',
        what: 'Under the last button; names what the in-app browser opens',
        href: '/demo/legal-link?doc=terms',
      },
      {
        title: 'Sign in with email',
        what: 'The checks, and the refused shake',
        href: '/demo/sign-in',
      },
      {
        title: 'Sign in · that sign-in timed out',
        what: 'A two-factor sign-in ran out, email kept',
        href: `/demo/sign-in?timedOut=1&email=${SAMPLE.email}`,
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
      {
        title: 'The sign-up runs out',
        what: 'The code, or Send a new code, goes back',
        href: '/demo/email-code?state=runOut',
      },
      {
        title: 'Create an account · timed out',
        what: 'Name and email kept, not the password',
        href: '/demo/create?state=timedOut',
      },
      {
        title: 'Create an account · timed out, opened again',
        what: 'Only the email kept',
        href: '/demo/create?state=timedOutReopened',
      },
      { title: 'Apple, the first time', what: 'Apple didn’t share the name', href: '/demo/apple' },
      {
        title: 'Google, the first time',
        what: 'Two steps',
        href: '/demo/organisation?via=google',
      },
      {
        title: 'Your organisation · no country',
        what: 'The device names none: Choose a country.',
        href: '/demo/organisation?region=none',
      },
      {
        title: 'Your mobile number · no code',
        what: 'The device names none: Choose a country.',
        href: '/demo/mobile?region=none',
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
        title: 'Lost the authenticator · sending the code',
        what: 'Email only, held sending',
        href: '/demo/lost?emailOnly=1&state=sending',
      },
      {
        title: 'Enter the code · expired',
        what: 'Email only, one code',
        href: '/demo/lost-codes?emailOnly=1&state=expired',
      },
      {
        title: 'Enter the code · too many wrong tries',
        what: 'Email only, one code',
        href: '/demo/lost-codes?emailOnly=1&state=exhausted',
      },
      {
        title: 'Enter both codes · expired',
        what: 'With a verified mobile, as today',
        href: '/demo/lost-codes?state=expired',
      },
      {
        title: 'Enter both codes · too many wrong tries',
        what: 'With a verified mobile, as today',
        href: '/demo/lost-codes?state=exhausted',
      },
      {
        title: 'Waiting for Ire Events',
        what: 'Answer it from the demo',
        href: '/demo/waiting',
      },
      {
        title: 'Waiting · cancel your request?',
        what: 'Cancel the request asks first',
        href: '/demo/waiting?state=cancel',
      },
      {
        title: 'Waiting · not cancelled',
        what: 'Soirely could not be reached',
        href: '/demo/waiting?state=notCancelled',
      },
      {
        title: 'Waiting · nobody left to confirm',
        what: 'The approvers left; Email Soirely support',
        href: '/demo/waiting?state=nobody',
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
            <Text
              size={tokens.typeBody.size}
              weight="semibold"
              selectable
              style={styles.sampleValue}
            >
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
  sampleValue: { fontVariant: ['tabular-nums'], letterSpacing: tokens.typeBody.size * 0.04 },
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
