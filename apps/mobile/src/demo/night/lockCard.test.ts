import { describe, expect, it } from 'vitest';

import {
  CARD_STATES,
  type CardStateName,
  LOCK_CARD_BOARDS,
  afterPress,
  afterSend,
  cardOf,
  cardScene,
  cardTitle,
  cardsOf,
  cardStateOf,
  heldAtStart,
  lockDate,
  surfaceOf,
  systemAge,
} from './lockCard.ts';
import {
  DANCED,
  FOYER_RUN,
  at,
  nightAt,
  pressDone,
  pressStart,
  sceneNight,
  tryNow,
} from './nightModel.ts';

const TITLE = 'Adaeze & Tunde’s wedding · Ballroom';

function shown(state: CardStateName) {
  return cardScene(state).cards.map((card) => [card.title, ...card.lines]);
}

describe('the card at each board state', () => {
  it('reads Now since its actual start and Next about its expected start', () => {
    expect(shown('now_next')).toEqual([
      [TITLE, 'Speeches · since 20:27', 'Next: First dance · about 21:07', 'As of 20:27'],
    ]);
  });

  it('says Nothing is on with Next, and Nothing else is planned with no Next', () => {
    expect(shown('nothing_on')[0]?.slice(1, 3)).toEqual([
      'Nothing is on',
      'Next: First dance · about 20:30',
    ]);
    expect(shown('no_next')[0]?.slice(1, 3)).toEqual([
      'Last song · since 00:27',
      'Nothing else is planned for Ballroom.',
    ]);
  });

  it('makes As of and the waiting count one line while this device is offline', () => {
    expect(shown('offline_one')[0]?.[3]).toBe('As of 20:27 · 1 press waiting to send');
    expect(shown('offline_two')[0]?.slice(1)).toEqual([
      'First dance · since 20:31',
      'Next: Cake cutting · about 20:46',
      'As of 20:31 · 2 presses waiting to send',
    ]);
  });

  it('takes the server’s card over this device’s own once signal is back, with no count', () => {
    const lines = shown('server_replaced')[0] ?? [];

    expect(lines[1]).toBe('Speeches · since 20:27');
    expect(lines[2]).toMatch(/^Next: First dance · about /);
    expect(lines[3]).toBe('As of 20:32');
  });

  it('ends on That’s everything. alone', () => {
    expect(shown('end')).toEqual([[TITLE, 'That’s everything.']]);
  });

  it('holds one card per place, each with its own As of', () => {
    expect(shown('two_tracks').map((card) => card[0])).toEqual([
      TITLE,
      'Adaeze & Tunde’s wedding · Foyer',
    ]);
    expect(shown('two_tracks')[1]?.slice(1)).toEqual([
      'Photo booth · since 19:00',
      'Next: Late bar · about 23:30',
      'As of 19:00',
    ]);
    expect(cardScene('two_tracks', 'en-US').ages).toEqual(['now', '1h ago']);
  });

  it('shows what the night shows after a losing replay', () => {
    expect(shown('lost')[0]?.slice(1)).toEqual([
      'First dance · since 20:31',
      'Next: Cake cutting · about 20:46',
      'As of 20:33',
    ]);
  });

  it('names an earlier day’s track as the picker does', () => {
    expect(shown('earlier_day')).toEqual([
      [
        'Adaeze & Tunde’s wedding · Foyer · Friday',
        'Late bar · since 23:30',
        'Nothing else is planned for Foyer.',
        'As of 09:10',
      ],
    ]);
  });

  it('cuts a 120-character Now to its first 39 and …, the time whole', () => {
    expect(shown('long_now')[0]?.[1]).toBe(
      'Speeches from the father of the bride, … · since 20:27',
    );
  });

  it('cuts French Next the same, the longest line, its colon kept off a line of its own', () => {
    expect(shown('long_next_fr')[0]?.slice(1)).toEqual([
      'Speeches · depuis 20:27',
      'Ensuite\u00a0: Discours du père de la mariée, du témoi… · vers 21:07',
      'Mise à jour\u00a0: 20:27',
    ]);
  });

  it('shows a title of 40 whole and counts as the title field counts', () => {
    expect(cardTitle('a'.repeat(40))).toBe('a'.repeat(40));
    expect(cardTitle('a'.repeat(41))).toBe(`${'a'.repeat(39)}…`);
    expect(cardTitle(`${'é'.repeat(38)}👍🏽👍🏽x`)).toBe(`${'é'.repeat(38)}👍🏽…`);
  });

  it('writes each line as one key in es, fr and pt, with the hour-is-1 article', () => {
    const night = sceneNight({
      name: '',
      clock: '01:15',
      hall: { ...DANCED, lastSong: ['00:27', '01:15'] },
    });
    const hall = night.tracks[0]!;

    expect(cardOf(night, hall, 'es-ES', at('01:15'), 1).lines).toEqual(['Eso es todo.']);
    expect(cardScene('offline_two', 'es-ES').cards[0]?.lines[2]).toBe(
      'Actualizado a las 20:31 · 2 acciones pendientes de enviar',
    );
    expect(cardScene('offline_one', 'pt-PT').cards[0]?.lines[2]).toBe(
      'Atualizado às 20:27 · 1 ação por enviar',
    );
    expect(cardScene('offline_one', 'fr-FR').cards[0]?.lines[2]).toBe(
      'Mise à jour\u00a0: 20:27 · 1 action en attente d’envoi',
    );
    expect(cardScene('no_next', 'es-ES').cards[0]?.lines).toEqual([
      'Last song · desde las 00:27',
      'No hay nada más previsto en Ballroom.',
      'Actualizado a las 00:27',
    ]);
    const late = sceneNight({
      name: '',
      clock: '01:10',
      foyer: { ...FOYER_RUN, carriages: ['01:10'] },
      hall: DANCED,
    });
    const foyer = late.tracks[1]!;

    expect(cardOf(late, foyer, 'pt-PT', at('01:10')).lines).toEqual([
      'Carriages · desde a 01:10',
      'Não há mais nada previsto em Foyer.',
      'Atualizado à 01:10',
    ]);
  });

  it('puts up no card with Event day push off', () => {
    expect(cardScene('push_off', 'en-US')).toMatchObject({ cards: [], pushOff: true });
  });

  it('never says over, and carries no owner', () => {
    const words = (Object.keys(CARD_STATES) as CardStateName[])
      .flatMap((state) => shown(state).flat())
      .join(' ');

    expect(words).not.toMatch(/over|Ifeoma|Tolu|Ronke/);
  });

  it('reads title, Now, Next, then As of', () => {
    expect(cardScene('now_next', 'en-US').cards[0]?.spoken).toBe(
      `${TITLE}. Speeches · since 20:27. Next: First dance · about 21:07. As of 20:27.`,
    );
  });
});

describe('presses on this device', () => {
  it('starts with a card for each track pressed on, as of its last press', () => {
    const { night } = nightAt('populated');

    expect(heldAtStart(night)).toEqual({ hall: { asOf: at('19:50'), waiting: 0 } });
  });

  it('replaces the track’s card at once, with the queue’s count offline, and one card after five presses', () => {
    let night = nightAt('populated').night;
    let held = heldAtStart(night);
    const offline = { ...night, online: false };

    const done = pressDone(offline, 'hall', 'speeches');
    held = afterPress(held, 'hall', offline, done);
    night = done;

    expect(held.hall).toEqual({ asOf: at('20:02'), waiting: 1 });
    expect(cardsOf(night, held, 'en-US')).toHaveLength(1);
    expect(cardsOf(night, held, 'en-US')[0]?.lines).toEqual([
      'Nothing is on',
      'Next: First dance · about 20:30',
      'As of 20:02 · 1 press waiting to send',
    ]);

    for (const step of ['dance', 'cake']) {
      const before = night;
      night = pressStart(before, 'hall', step);
      held = afterPress(held, 'hall', before, night);
      const ended = pressDone(night, 'hall', step);
      held = afterPress(held, 'hall', night, ended);
      night = ended;
    }

    expect(cardsOf(night, held, 'en-US')).toHaveLength(1);
    expect(held.hall?.waiting).toBe(5);
  });

  it('changes nothing for a press the night refused', () => {
    const { night } = nightAt('populated');
    const held = heldAtStart(night);

    expect(afterPress(held, 'hall', night, pressStart(night, 'hall', 'dance'))).toBe(held);
  });

  it('drops the waiting part once the queue has sent', () => {
    const { night } = nightAt('offline');
    const held = heldAtStart(night);

    expect(held.hall?.waiting).toBe(2);
    expect(afterSend(held, tryNow(night).clock).hall).toEqual({ asOf: at('20:02'), waiting: 0 });
  });
});

describe('the links', () => {
  it('opens a known state and surface, or the first', () => {
    expect(cardStateOf('end')).toBe('end');
    expect(cardStateOf('nope')).toBe('now_next');
    expect(surfaceOf('shadeOpen')).toBe('shadeOpen');
    expect(surfaceOf(undefined)).toBe('lock');
  });

  it('lists every state once', () => {
    const states = LOCK_CARD_BOARDS.map(
      (board) => /lock-screen-card\?state=(\w+)$/.exec(board.href)?.[1],
    ).filter((state) => state != null);

    expect(states).toEqual(Object.keys(CARD_STATES));
  });

  it('dates the lock screen past midnight as the next day', () => {
    expect(lockDate(at('20:27'))).toBe('Friday, Nov 20');
    expect(lockDate(at('00:27'))).toBe('Saturday, Nov 21');
    expect(lockDate(at('20:27'), 'fr-FR')).toBe('vendredi 20 nov.');
  });

  it('writes the system’s age as the lock screen does', () => {
    expect(systemAge(at('20:27'), at('20:27'))).toBe('now');
    expect(systemAge(at('20:40'), at('20:27'))).toBe('13m ago');
  });
});
