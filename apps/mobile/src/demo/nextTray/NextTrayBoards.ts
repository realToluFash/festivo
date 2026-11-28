import { TRAY_STATES, TRAY_STATE_WHAT } from './nextTrayModel.ts';

export const NEXT_TRAY_BOARDS = TRAY_STATES.map((state) => ({
  title: `Next, the tray · ${TRAY_STATE_WHAT[state][0]}`,
  what: TRAY_STATE_WHAT[state][1],
  href: `/demo/next-tray?state=${state}`,
}));
