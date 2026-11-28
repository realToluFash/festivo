import { REQUEST_STATES, REQUEST_STATE_WHAT } from './RequestsModel.ts';

export const REQUEST_BOARDS = REQUEST_STATES.map((state) => ({
  title: `Requests · ${REQUEST_STATE_WHAT[state][0]}`,
  what: REQUEST_STATE_WHAT[state][1],
  href: `/demo/requests?state=${state}`,
}));
