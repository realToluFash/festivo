import type { ReadOnlyStateName } from './readOnlyRules.ts';

export interface ReadOnlyBoard {
  title: string;
  what: string;
  href: string;
}

const at = (state: ReadOnlyStateName, title: string, what: string): ReadOnlyBoard => ({
  title,
  what,
  href: `/demo/read-only?state=${state}`,
});

/** The app has no import, no new message and no invitation, so only these are refused here. */
export const READ_ONLY_BOARDS: readonly ReadOnlyBoard[] = [
  at('makeLive', 'Make live · billing.manage', 'The payment cannot be made in the app.'),
  at('makeLiveOther', 'Make live · anyone else', 'Ask someone who manages billing'),
  at('createEvent', 'New event · billing.manage', 'The form kept'),
  at('duplicate', 'Duplicate · anyone else', 'The form kept'),
  at('guestNotLive', 'Add guest, not live · billing.manage', 'The form kept'),
  at('guestNotLiveOther', 'Add guest, not live · anyone else', 'Ask someone who manages billing'),
];
