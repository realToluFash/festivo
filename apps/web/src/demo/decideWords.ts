import es from '../i18n/locales/es.json';
import { demoWords } from './demoWords.ts';

/** What a decision costs (sc-86): the answer's words, the board's proposals for [en]. Add guest's own words are Guests A's, in `GW`. */
export const DECIDE_WORDS = {
  addCompanion: 'Add a companion',
  head: 'What adding them would cost',
  rise: (amount: string) => `+${amount} if all come`,
  upperOnly: (total: string, settled: string) =>
    `If everyone comes, it would be ${total}. Settled, it stays ${settled}, because new guests have not replied.`,
  moved: (from: string, to: string, headsFrom: number, headsTo: number) =>
    `${from} → ${to} · ${headsFrom} → ${headsTo} if all come`,
  plus: (amount: string) => `+${amount}`,
  notKnown: 'Not known',
  notKnownIfAll: 'Not known if all come',
  notPricedYet: 'Not priced yet, so its cost is not known',
  fullNotKnown: (count: number) =>
    count === 1
      ? 'Full cost not known: 1 cost it moves has no price yet.'
      : `Full cost not known: ${count} costs it moves have no price yet.`,
  noChange: 'No change',
  nothingPerGuest: 'Nothing in this budget is counted per guest.',
  overCeiling: 'This would take the event over its ceiling.',
  overCategory: (category: string) => `This would take ${category} over its ceiling.`,
  ifEveryone: (total: string, ceiling: string) =>
    `If everyone comes, it would be ${total} against ${ceiling}.`,
} as const;

export type AnswerWords = {
  readonly [K in keyof typeof DECIDE_WORDS]: (typeof DECIDE_WORDS)[K] extends (
    ...args: infer P
  ) => string
    ? (...args: P) => string
    : string;
};

/** sc-72618's Spanish answer, the product's own words (es.json); the ceilings' lines are not in it, and the huge event has no ceiling. */
export function answerWordsFor(lang: 'en' | 'es'): AnswerWords {
  if (lang === 'en') return DECIDE_WORDS;
  const said = es.decisionAnswer;
  const { filled, many } = demoWords(said, { locale: 'es-ES' });

  return {
    ...DECIDE_WORDS,
    head: said.head,
    rise: (amount) => filled(said.rise, { amount }),
    upperOnly: (upper, settled) => filled(said.upperOnly, { upper, settled }),
    moved: (from, to, headsFrom, headsTo) => filled(said.moved, { from, to, headsFrom, headsTo }),
    plus: (amount) => filled(said.plus, { amount }),
    notKnown: said.notKnown,
    notKnownIfAll: said.notKnownIfAll,
    notPricedYet: said.notPricedYet,
    fullNotKnown: (count) => many('fullNotKnown', count),
    noChange: said.noChange,
    nothingPerGuest: said.nothingPerGuest,
  };
}
