import type { PassTicket } from './PassModel.ts';

/** Page 35's sample pass (Service.dc.html), Main fired from 20:00; the printers' names stand in for what iOS gives. */
export const TICKETS: readonly PassTicket[] = [
  {
    table: 'T9',
    covers: 10,
    wait: 14,
    firedAt: '19:58',
    allergies: ['Nut · seat 3 · Adaeze O-W', 'Nut · seat 4 · Nneka O-W'],
    lines: [
      { count: 6, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 2, dish: 'Jollof · chicken · plantain', tone: 'chicken', flag: 'No nut' },
      { count: 1, dish: 'Pounded yam · suya · moi moi', tone: 'suya' },
      { count: 1, dish: 'Couscous · tofu · salad', tone: 'tofu', flag: 'Veg', preference: true },
    ],
    preference: '1 halal · seat 7 · covered by chicken',
  },
  {
    table: 'T12',
    covers: 10,
    wait: 6,
    firedAt: '20:06',
    allergies: [],
    lines: [
      { count: 5, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 3, dish: 'Jollof · fish · salad', tone: 'fish' },
      { count: 2, dish: 'Pounded yam · suya · moi moi', tone: 'suya' },
    ],
  },
  {
    table: 'T13',
    covers: 10,
    wait: 4,
    firedAt: '20:08',
    allergies: ['Coeliac · seat 2 · Tomás F-L'],
    lines: [
      { count: 4, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 4, dish: 'Jollof · fish · salad', tone: 'fish' },
      { count: 1, dish: 'Jollof · fish · salad', tone: 'fish', flag: 'No gluten' },
      { count: 1, dish: 'Chef’s choice · no pick', tone: 'none' },
    ],
  },
  {
    table: 'T14',
    covers: 8,
    wait: 3,
    firedAt: '20:09',
    allergies: [],
    lines: [
      { count: 6, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 2, dish: 'Couscous · tofu · salad', tone: 'tofu', flag: 'Veg', preference: true },
    ],
    preference: '2 vegetarian',
  },
  {
    table: 'T15',
    covers: 10,
    wait: 2,
    firedAt: '20:10',
    allergies: [],
    lines: [
      { count: 7, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 3, dish: 'Pounded yam · suya · moi moi', tone: 'suya' },
    ],
  },
  {
    table: 'T16',
    covers: 10,
    wait: 1,
    firedAt: '20:11',
    allergies: ['Shellfish · seat 9 · Ama B'],
    lines: [
      { count: 8, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
      { count: 2, dish: 'Jollof · fish · salad', tone: 'fish' },
    ],
  },
];

export const FIRED_LATER: PassTicket = {
  table: 'T17',
  covers: 8,
  wait: 0,
  firedAt: '20:13',
  allergies: [],
  lines: [
    { count: 5, dish: 'Jollof · chicken · plantain', tone: 'chicken' },
    { count: 3, dish: 'Jollof · fish · salad', tone: 'fish' },
  ],
};

export const PRINTERS = ['Kitchen TSP143IV', 'Bar mC-Print3'] as const;
export const NOW = '20:12';
export const FIRE_AT = '20:13';
