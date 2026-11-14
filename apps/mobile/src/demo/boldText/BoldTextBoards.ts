import { SAMPLE } from '../samples.ts';

export interface BoldTextBoard {
  title: string;
  what: string;
  href: string;
}

export const BOLD_TEXT_BOARDS: readonly BoldTextBoard[] = [
  {
    title: 'Bold text · the map and the screens',
    what: 'Off to start, with the switch beside each screen',
    href: '/demo/bold-text',
  },
  {
    title: 'Bold text · on',
    what: 'The same board with it on',
    href: '/demo/bold-text?bold=on',
  },
];

/** The screens QA checks, opened from the board so its switch comes with them. */
export const BOLD_TEXT_SCREENS: readonly BoldTextBoard[] = [
  {
    title: 'Sign in · welcome',
    what: 'Apple in the system font on the iPhone, Google unchanged',
    href: '/demo/welcome',
  },
  {
    title: 'Sign in with email · password shown',
    what: 'Typed, so press Show: SemiBold every time it is shown',
    href: `/demo/sign-in?email=${SAMPLE.email}&password=${encodeURIComponent(SAMPLE.password)}`,
  },
  {
    title: 'Home · Today, as an organiser',
    what: 'Lines in SemiBold under titles in Bold',
    href: '/demo/today',
  },
  { title: 'Settings', what: 'The list and your account', href: '/demo/settings' },
  {
    title: 'Settings › Security',
    what: 'Ways in, two-factor, devices',
    href: '/demo/settings/security',
  },
  {
    title: 'Settings in Spanish',
    what: 'Security’s line wraps, as it does off, and nothing is cut',
    href: '/demo/bold-text/spanish',
  },
];
