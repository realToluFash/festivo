import { CLOCK_STATES, BOARD_TITLES } from './shiftClockModel.ts';
import { HOURS_BOARD_TITLES, HOURS_STATES } from './staffHoursModel.ts';

const IN_BROWSER = new Set([
  'access_ended_clocked_in',
  'access_ended_clocked_out',
  'access_ended_offline',
  'access_ended_already',
]);

export const SHIFT_CLOCK_BOARDS = CLOCK_STATES.flatMap((state) => {
  const [title, what] = BOARD_TITLES[state];
  const app = { title: `Clock card · ${title}`, what, href: `/demo/shift-clock?state=${state}` };

  return IN_BROWSER.has(state)
    ? [
        app,
        {
          title: `Clock card · ${title} · in a browser`,
          what: 'The browser-only lines',
          href: `/demo/shift-clock?state=${state}&surface=browser`,
        },
      ]
    : [app];
});

export const STAFF_HOURS_BOARDS = HOURS_STATES.map((state) => {
  const [title, what] = HOURS_BOARD_TITLES[state];

  return { title: `Hours · ${title}`, what, href: `/demo/staff-hours?state=${state}` };
});
