import { describe, expect, it } from 'vitest';

import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import { MESSAGES_STATES, type Messages, badgeOf, sectionsOf, startOf } from './MessagesModel.ts';
import { guestOf } from './NoticeStates.ts';
import {
  TAP_STATES,
  type TapItem,
  type TapState,
  closedOn,
  hostsIn,
  lineWords,
  tapItemsOf,
  tapRowOf,
} from './TapStates.ts';

const itemsOf = (state: TapState): TapItem[] => {
  const tap = startOf(state, false).tap;

  return tap == null ? [] : tapItemsOf(tap);
};
const linesOf = (state: TapState) =>
  itemsOf(state).flatMap((item) => (item.kind === 'line' ? [lineWords(item)] : []));
const messagesOf = (state: TapState) =>
  itemsOf(state).flatMap((item) => (item.kind === 'message' ? [item.lines] : []));
const underOf = (state: TapState) =>
  itemsOf(state).flatMap((item) =>
    item.kind === 'message'
      ? [[item.receipt.mark, item.receipt.word]]
      : item.kind === 'notSent'
        ? [[item.mark, item.word]]
        : [],
  );
const sectionOf = (m: Messages, key: string) => {
  const sections = sectionsOf(m);
  const has = (ids: typeof sections.needs) =>
    ids.some((id) => id.kind === 'guest' && id.key === key);

  return has(sections.needs) ? 'needs' : has(sections.done) ? 'done' : null;
};

const RECORDED_NOT_COMING = [
  'Thank you. We have told Adaeze Obi and Tunde Bakare that you are not coming.',
  'If you change your mind, the buttons in the invitation still work.',
];

describe('a WhatsApp tap in a guest’s conversation (sc-46343)', () => {
  it('are eleven states after sc-3976’s, each with a board in the demo', () => {
    const at = MESSAGES_STATES.indexOf('readOnly') + 1;

    expect(MESSAGES_STATES.slice(at, at + 11)).toEqual([...TAP_STATES]);
    expect(
      MESSAGES_BOARDS.filter((board) => board.state.startsWith('tap')).map((board) => board.title),
    ).toEqual([
      'Messages · A tap: Not coming, with companions',
      'Messages · A tap: Not sure yet',
      'Messages · A tap under a question that waits',
      'Messages · A tap: the message failed',
      'Messages · A tap: too few credits',
      'Messages · A tap after stopping WhatsApp',
      'Messages · A Coming guest’s tap',
      'Messages · A Coming guest’s tap, too few credits',
      'Messages · A repeat tap, the first in 24 hours',
      'Messages · A further repeat: no line',
      'Messages · A tap after answers closed',
    ]);
  });

  it('opens Kwame’s conversation by WhatsApp, done at 21:30, or Lucía’s waiting', () => {
    const kwame = startOf('tapNotComing', false);

    expect(kwame.open).toEqual({ kind: 'guest', key: 'kwame' });
    expect(kwame.doneAt.kwame).toBe('21:30');
    expect(guestOf(kwame, 'kwame').channel).toBe('wa');
    expect(guestOf(kwame, 'kwame').asked.text).toBe('What is the dress code?');
    expect(startOf('tapNeedsYou', false).open).toEqual({ kind: 'guest', key: 'lucia' });
    expect(startOf('tapStopped', false).notice?.extras).toEqual([
      { kind: 'stopped', channel: 'wa', time: '08:15' },
    ]);
  });

  it('says each tap as its line, with the time after a middle dot', () => {
    expect(TAP_STATES.map((state) => linesOf(state))).toEqual([
      ['Kwame Mensah answered Not coming by WhatsApp. · 08:20'],
      ['Kwame Mensah answered Not sure yet by WhatsApp. · 08:20'],
      ['Lucía Ortega answered Not sure yet by WhatsApp. · 08:20'],
      ['Kwame Mensah answered Not coming by WhatsApp. · 08:20'],
      ['Kwame Mensah answered Not coming by WhatsApp. · 08:20'],
      ['Lucía Ortega answered Not coming by WhatsApp. · 08:20'],
      ['Kwame Mensah tapped Not coming in WhatsApp. Nothing changed. · 08:20'],
      ['Kwame Mensah tapped Not coming in WhatsApp. Nothing changed. · 08:20'],
      [
        'Kwame Mensah answered Not sure yet by WhatsApp. · 08:20',
        'Kwame Mensah tapped Not sure yet in WhatsApp. Nothing changed. · 08:31',
      ],
      [
        'Kwame Mensah answered Not sure yet by WhatsApp. · 08:20',
        'Kwame Mensah tapped Not sure yet in WhatsApp. Nothing changed. · 08:31',
      ],
      ['Kwame Mensah tapped Not sure yet in WhatsApp. Nothing changed. · 08:20'],
    ]);
  });

  it('writes Soirely’s message in the guest’s language, with the companions line where it applies', () => {
    expect(messagesOf('tapNotComing')).toEqual([
      [RECORDED_NOT_COMING[0], 'Your companions won’t be coming either.', RECORDED_NOT_COMING[1]],
    ]);
    expect(messagesOf('tapNotSure')).toEqual([
      [
        'Thank you. We have told Adaeze Obi and Tunde Bakare that you are not sure yet.',
        'If you change your mind, the buttons in the invitation still work.',
      ],
    ]);
    expect(messagesOf('tapNeedsYou')).toEqual([
      [
        'Gracias. Hemos avisado a Adaeze Obi y Tunde Bakare de que aún no lo sabe.',
        'Sus acompañantes quedan en espera hasta que usted decida.',
        'Si cambia de opinión, los botones de la invitación siguen funcionando.',
      ],
    ]);
    expect(messagesOf('tapFailed')).toEqual([RECORDED_NOT_COMING]);
    expect(messagesOf('tapComing')).toEqual([
      [
        'You’re down as Coming, so nothing has changed. To change your answer, open your page with “Yes, I’ll be there” in the invitation.',
      ],
    ]);
    expect(messagesOf('tapRepeat')[1]).toEqual([
      'You’re already down as Not sure yet. Nothing has changed.',
    ]);
    expect(messagesOf('tapClosed')).toEqual([
      ['Answers closed on 2 November 2026. Contact your host if something has changed.'],
    ]);
    expect(
      ['tapNoCredits', 'tapStopped', 'tapComingNotSent'].map((one) => messagesOf(one as TapState)),
    ).toEqual([[], [], []]);
    expect([hostsIn('en'), hostsIn('es'), closedOn()]).toEqual([
      'Adaeze Obi and Tunde Bakare',
      'Adaeze Obi y Tunde Bakare',
      '2 November 2026',
    ]);
  });

  it('puts WhatsApp’s receipt under the message, or Not sent with its mark', () => {
    expect(TAP_STATES.map((state) => underOf(state))).toEqual([
      [['delivered', 'WhatsApp · Read']],
      [['delivered', 'WhatsApp · Delivered']],
      [['sent', 'WhatsApp · Sent']],
      [['bounced', 'WhatsApp · Failed']],
      [['notsent', 'Not sent · Too few credits']],
      [['optout', 'Not sent · Stopped WhatsApp']],
      [['delivered', 'WhatsApp · Read']],
      [['notsent', 'Not sent · Too few credits']],
      [
        ['delivered', 'WhatsApp · Read'],
        ['delivered', 'WhatsApp · Delivered'],
      ],
      [
        ['delivered', 'WhatsApp · Read'],
        ['delivered', 'WhatsApp · Delivered'],
      ],
      [['delivered', 'WhatsApp · Delivered']],
    ]);
  });

  it('puts a Today rule before Kwame’s taps, and none before Lucía’s, asked today', () => {
    expect(itemsOf('tapNotComing')[0]).toEqual({ kind: 'today' });
    expect(itemsOf('tapNeedsYou')[0]?.kind).toBe('line');
  });

  it('shows a further repeat as the first repeat left it, with no third line', () => {
    expect(itemsOf('tapRepeatAgain')).toEqual(itemsOf('tapRepeat'));
  });

  it('never moves the conversation: Kwame stays in Done, Lucía in Needs you, the badge as it was', () => {
    const kwame = TAP_STATES.filter((state) => startOf(state, false).tap?.key === 'kwame');

    expect(kwame).toHaveLength(9);
    expect(kwame.map((state) => sectionOf(startOf(state, false), 'kwame'))).toEqual(
      kwame.map(() => 'done'),
    );
    expect(sectionOf(startOf('tapNeedsYou', false), 'lucia')).toBe('needs');
    expect(sectionOf(startOf('tapStopped', false), 'lucia')).toBe('needs');
    expect(badgeOf(startOf('tapNeedsYou', false))).toEqual(badgeOf(startOf(null, false)));
  });

  it('gives the row the latest tap line and its time', () => {
    expect(tapRowOf(startOf('tapNotComing', false), 'kwame')).toEqual({
      line: 'Kwame Mensah answered Not coming by WhatsApp.',
      time: '08:20',
    });
    expect(tapRowOf(startOf('tapRepeat', false), 'kwame')).toEqual({
      line: 'Kwame Mensah tapped Not sure yet in WhatsApp. Nothing changed.',
      time: '08:31',
    });
    expect(tapRowOf(startOf('tapNeedsYou', false), 'kwame')).toBeNull();
    expect(tapRowOf(startOf(null, false), 'kwame')).toBeNull();
  });
});
