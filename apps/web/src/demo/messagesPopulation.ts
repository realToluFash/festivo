import type { Reply, SampleGuest } from './messagesTo.ts';
import { crowdName } from './sampleNames.ts';

const one = (
  name: string,
  reply: Reply,
  group: string | null,
  email: boolean,
  mobile: boolean,
  invited = true,
): SampleGuest => ({ name, reply, invited, group, email, mobile });

/** [group, reply, how many, with an email, with a mobile], the rest of the 142 by these sums. */
const CELLS: readonly [string | null, Reply, number, number, number][] = [
  ['family', 'coming', 10, 10, 4],
  ['family', 'notComing', 1, 1, 0],
  ['family', 'notSure', 1, 1, 1],
  ['oldSchool', 'coming', 9, 9, 3],
  ['oldSchool', 'none', 2, 2, 1],
  ['oldSchool', 'notComing', 1, 1, 0],
  ['work', 'coming', 16, 15, 6],
  ['work', 'notComing', 4, 3, 1],
  ['work', 'notSure', 2, 2, 0],
  [null, 'coming', 56, 53, 13],
  [null, 'none', 17, 15, 5],
  [null, 'notComing', 6, 5, 2],
  [null, 'notSure', 4, 4, 1],
];

function populated(): SampleGuest[] {
  let at = 0;
  const made = CELLS.flatMap(([group, reply, count, emails, mobiles]) =>
    Array.from({ length: count }, (_, index) => {
      at += 1;

      return one(crowdName(at - 1), reply, group, index < emails, index >= count - mobiles);
    }),
  );

  return [
    one('Abena Mensah', 'none', 'family', true, true),
    one('Chidi Okeke', 'none', 'family', true, false),
    one('Grace Adeyemi', 'none', 'family', false, true),
    one('Ifeoma Bello', 'none', 'family', true, true),
    one('Kofi Asante', 'none', 'family', false, false),
    one('Yetunde Bakare', 'none', 'family', true, false),
    ...['Bisi Adewale', 'Camille Dubois', 'Kemi Bankole', 'Kwame Mensah', 'Lucía Ortega'].map(
      (name) => one(name, 'coming', null, true, true),
    ),
    one('Joaquín Ruiz', 'none', null, false, false, false),
    one('Mei Lin Chen', 'none', null, false, false, false),
    ...made,
  ];
}

/** The wedding's 142 guests, each with their reply, invitation, group and channels. */
export const POPULATION: readonly SampleGuest[] = populated();
