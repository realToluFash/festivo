import { describe, expect, it } from 'vitest';

import { actionsUnder, brokeInWord, brokeOn, labelFits, rowRoom } from './titleFit.ts';

const row = { room: 400, title: 140, extra: 0, labelled: 170, gap: 16 };

describe('the primary beside a title', () => {
  it('keeps its label where the title and the label both fit', () => {
    expect(labelFits(row)).toBe(true);
  });

  it('gives way to the round plus where they do not', () => {
    expect(labelFits({ ...row, title: 230 })).toBe(false);
  });

  it('fits on exactly the width the row has', () => {
    expect(labelFits({ ...row, room: 140 + 16 + 170 })).toBe(true);
    expect(labelFits({ ...row, room: 140 + 16 + 170 - 1 })).toBe(false);
  });

  it('counts what stands beside the title, with its own gap', () => {
    expect(labelFits({ ...row, extra: 60, room: 402 })).toBe(true);
    expect(labelFits({ ...row, extra: 60, room: 401 })).toBe(false);
  });

  it('keeps the label until the row is measured', () => {
    expect(labelFits({ ...row, room: 0 })).toBe(true);
    expect(labelFits({ ...row, title: 0 })).toBe(true);
  });
});

describe('the row a title stands in', () => {
  const sides = { gap: 16, labelled: 170, round: 44 };

  it('adds back the labelled primary when that is what was drawn', () => {
    expect(rowRoom({ ...sides, slot: 214, drawn: 'labelled' })).toBe(400);
  });

  it('adds back the round primary when that is what was drawn', () => {
    expect(rowRoom({ ...sides, slot: 340, drawn: 'round' })).toBe(400);
  });

  it('is the same row whichever primary took its share, so a flip settles', () => {
    const labelled = rowRoom({ ...sides, slot: 400 - 16 - 170, drawn: 'labelled' });
    const round = rowRoom({ ...sides, slot: 400 - 16 - 44, drawn: 'round' });
    expect(labelled).toBe(round);
  });

  it('is unmeasured until the slot is', () => {
    expect(rowRoom({ ...sides, slot: null, drawn: 'labelled' })).toBe(0);
  });

  it('leaves the title no room when its slot is squeezed to nothing, so the primary goes round', () => {
    const room = rowRoom({ ...sides, slot: 0, drawn: 'labelled' });
    expect(room).toBe(16 + 170);
    expect(labelFits({ room, title: 90, extra: 0, labelled: 170, gap: 16 })).toBe(false);
  });
});

describe('Export and the + under the title (sc-68417)', () => {
  const actions = { room: 370, title: 170, extra: 0, plus: 44, bell: 0, refreshing: 0, gap: 10 };

  it('stay beside the title where all three fit', () => {
    expect(actionsUnder({ ...actions, extra: 120 })).toBe(false);
  });

  it('go under it where the title would have to break', () => {
    expect(actionsUnder({ ...actions, title: 215, extra: 200 })).toBe(true);
  });

  it('fit on exactly the width the row has', () => {
    expect(actionsUnder({ ...actions, extra: 124, room: 170 + 10 + 124 + 10 + 44 })).toBe(false);
    expect(actionsUnder({ ...actions, extra: 124, room: 170 + 10 + 124 + 10 + 44 - 1 })).toBe(true);
  });

  it('count the bell on its side, with its own gap', () => {
    const room = 170 + 10 + 100 + 10 + 44 + 10 + 44;
    expect(actionsUnder({ ...actions, extra: 100, bell: 44, room })).toBe(false);
    expect(actionsUnder({ ...actions, extra: 100, bell: 44, room: room - 1 })).toBe(true);
  });

  it('count a refresh spinner while it shows, with its own gap', () => {
    const room = 170 + 10 + 100 + 10 + 44 + 10 + 44;
    expect(actionsUnder({ ...actions, extra: 100, bell: 44, room })).toBe(false);
    expect(actionsUnder({ ...actions, extra: 100, bell: 44, refreshing: 20, room })).toBe(true);
    expect(
      actionsUnder({ ...actions, extra: 100, bell: 44, refreshing: 20, room: room + 30 }),
    ).toBe(false);
  });

  it('stay beside it until the row and the title are measured', () => {
    expect(actionsUnder({ ...actions, extra: 400, room: 0 })).toBe(false);
    expect(actionsUnder({ ...actions, extra: 400, title: 0 })).toBe(false);
  });
});

const inSlot = { slot: 180, title: 180 };

describe('a title that broke beside its actions all the same (sc-68417)', () => {
  const broken = [{ text: 'Convidad' }, { text: 'os' }];
  const whole = [{ text: 'Convidados' }];

  it('broke where it is at its default size and still wraps inside its word', () => {
    expect(brokeInWord({ lines: broken, drawn: 30, start: 43, size: 30, ...inSlot })).toBe(true);
  });

  it('broke where it stepped down part way and still wraps, as it steps no further', () => {
    expect(brokeInWord({ lines: broken, drawn: 34, start: 43, size: 30, ...inSlot })).toBe(true);
  });

  it('did not break while it is still at its start size, as it steps down next', () => {
    expect(brokeInWord({ lines: broken, drawn: 43, start: 43, size: 30, ...inSlot })).toBe(false);
  });

  it('broke at the default text size, where its start is its default size', () => {
    expect(brokeInWord({ lines: broken, drawn: 30, start: 30, size: 30, ...inSlot })).toBe(true);
  });

  it('did not break on one line, or between words', () => {
    expect(brokeInWord({ lines: whole, drawn: 30, start: 43, size: 30, ...inSlot })).toBe(false);
    const between = [{ text: 'Lista de ' }, { text: 'convidados' }];
    expect(brokeInWord({ lines: between, drawn: 30, start: 43, size: 30, ...inSlot })).toBe(false);
  });

  it('did not break in a slot narrower than the title, as the row is still laying out', () => {
    const atDefault = { lines: broken, drawn: 30, start: 30, size: 30 };
    expect(brokeInWord({ ...atDefault, slot: 120, title: 180 })).toBe(false);
    expect(brokeInWord({ ...atDefault, slot: 0, title: 180 })).toBe(false);
    expect(brokeInWord({ ...atDefault, slot: 179, title: 180 })).toBe(true);
  });
});

describe('the row the title broke on (sc-68417)', () => {
  const broken = [{ text: 'Convidad' }, { text: 'os' }];
  const whole = [{ text: 'Convidados' }];
  const atFloor = { drawn: 30, start: 43, size: 30, ...inSlot };

  it('is this row once the title breaks beside its actions', () => {
    expect(brokeOn({ broke: null, row: '370|pt', under: false, lines: broken, ...atFloor })).toBe(
      '370|pt',
    );
  });

  it('stays as it was while the actions are already under', () => {
    expect(
      brokeOn({ broke: null, row: '370|pt', under: true, lines: broken, ...atFloor }),
    ).toBeNull();
  });

  it('stays as it was while the title is whole', () => {
    expect(
      brokeOn({ broke: '360|pt', row: '370|pt', under: false, lines: whole, ...atFloor }),
    ).toBe('360|pt');
  });

  it('is not this row where the title broke while its slot was still narrower than it (sc-68417, iPad on its side)', () => {
    expect(
      brokeOn({
        broke: null,
        row: '700|Guests',
        under: false,
        lines: [{ text: 'Gue' }, { text: 'sts' }],
        drawn: 26,
        start: 26,
        size: 26,
        slot: 60,
        title: 92,
      }),
    ).toBeNull();
  });

  it('is not yet this row at the start size, where the title steps down next', () => {
    const atStart = { drawn: 43, start: 43, size: 30, ...inSlot };
    expect(
      brokeOn({ broke: null, row: '370|pt', under: false, lines: broken, ...atStart }),
    ).toBeNull();
  });
});
