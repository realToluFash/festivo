import { AUTO_STATES, AUTO_STATE_WHAT } from './AutomaticModel.ts';

export const AUTO_BOARDS = AUTO_STATES.map((state) => ({
  title: `Messages · automatic messages · ${state}`,
  what: AUTO_STATE_WHAT[state],
  href: `/demo/automatic-messages?state=${state}`,
}));
