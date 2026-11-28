import { RUN_OUT_STATES, RUN_OUT_STATE_WHAT } from './runOutTrayModel.ts';

export const RUN_OUT_TRAY_BOARDS = RUN_OUT_STATES.map((state) => ({
  title: `The waiter’s tray, run out · ${RUN_OUT_STATE_WHAT[state][0]}`,
  what: RUN_OUT_STATE_WHAT[state][1],
  href: `/demo/run-out-tray?state=${state}`,
}));
