import { ASK_STATES, ASK_STATE_WHAT } from './askAtTableModel.ts';

export const ASK_AT_TABLE_BOARDS = ASK_STATES.map((state) => ({
  title: `The waiter asks at the table · ${ASK_STATE_WHAT[state][0]}`,
  what: ASK_STATE_WHAT[state][1],
  href: `/demo/ask-at-table?state=${state}`,
}));
