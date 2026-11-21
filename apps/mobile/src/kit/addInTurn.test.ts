import { describe, expect, it } from 'vitest';

import { addInTurn } from './addInTurn.ts';

function adding(refuses: readonly string[] = []) {
  const sent: string[] = [];

  return {
    sent,
    add: (id: string) => {
      sent.push(id);

      return refuses.includes(id) ? Promise.reject(new Error(id)) : Promise.resolve(`p_${id}`);
    },
  };
}

describe('addInTurn', () => {
  it('adds one member', async () => {
    const api = adding();

    expect(await addInTurn(['kofi'], api.add)).toEqual({ kind: 'all', added: ['p_kofi'] });
  });

  it('adds three members, one after another, in the order ticked', async () => {
    const api = adding();

    expect(await addInTurn(['kofi', 'ana', 'tom'], api.add)).toEqual({
      kind: 'all',
      added: ['p_kofi', 'p_ana', 'p_tom'],
    });
    expect(api.sent).toEqual(['kofi', 'ana', 'tom']);
  });

  it('stops at a refusal, naming who went in and who is still ticked', async () => {
    const api = adding(['ana']);
    const sent = await addInTurn(['kofi', 'ana', 'tom'], api.add);

    expect(sent).toMatchObject({
      kind: 'stopped',
      added: ['p_kofi'],
      went: ['kofi'],
      left: ['ana', 'tom'],
    });
    expect(api.sent).toEqual(['kofi', 'ana']);
  });

  it('names nobody as gone in when the first is refused', async () => {
    const api = adding(['kofi']);

    expect(await addInTurn(['kofi', 'ana'], api.add)).toMatchObject({
      kind: 'stopped',
      added: [],
      went: [],
      left: ['kofi', 'ana'],
    });
  });
});
