export interface SignOutSizeBoard {
  title: string;
  what: string;
  href: string;
}

/** Each size sc-66900 asks for, in English and in French. */
export const SIGN_OUT_SIZE_BOARDS: readonly SignOutSizeBoard[] = [
  {
    title: 'Sign out · default size',
    what: 'The 52 pill, as on main',
    href: '/demo/sign-out-size?size=default&lang=en',
  },
  {
    title: 'Se déconnecter · default size',
    what: 'The 52 pill, as on main',
    href: '/demo/sign-out-size?size=default&lang=fr',
  },
  {
    title: 'Sign out · ninth step',
    what: 'One line at full size; the pill grows past 52',
    href: '/demo/sign-out-size?size=ninth&lang=en',
  },
  {
    title: 'Se déconnecter · ninth step',
    what: 'The pill grows to hold its words, each whole',
    href: '/demo/sign-out-size?size=ninth&lang=fr',
  },
  {
    title: 'Sign out · twelfth step',
    what: 'Its words whole at full size in a taller capsule',
    href: '/demo/sign-out-size?size=twelfth&lang=en',
  },
  {
    title: 'Se déconnecter · twelfth step',
    what: 'Two lines, déconnecter whole beside the glyph',
    href: '/demo/sign-out-size?size=twelfth&lang=fr',
  },
  {
    title: 'Se déconnecter · Android 200%',
    what: 'On a 360 phone, every word whole',
    href: '/demo/sign-out-size?size=android&lang=fr',
  },
];
