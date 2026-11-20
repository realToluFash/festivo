/** Today in a desk window from 641 to 1439 px wide (sc-57575), opened at 641, 768, 834 and 1024 px in English and French. */
export const DESK_FIT_PAGES: readonly {
  name: string;
  states: readonly { to: string; name: string }[];
}[] = [
  {
    name: 'Today',
    states: [
      { to: '/demo/today', name: 'This week and Your events, the wedding over three days' },
      { to: '/demo/today?name=long', name: 'An event name of 120 characters' },
      {
        to: '/demo/today?moment=plan&needs=overdue&name=long',
        name: 'Needs you, an overdue row for an event name of 120 characters',
      },
      { to: '/demo/today?moment=plan&week=rows', name: 'Events sharing days in rows' },
      { to: '/demo/today?moment=day', name: 'The event day' },
    ],
  },
];
