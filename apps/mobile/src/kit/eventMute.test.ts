import { describe, expect, it } from 'vitest';

import { type MutesEvents, readMute, saveMute } from './eventMute.ts';

function client(answers: Partial<MutesEvents>): MutesEvents {
  return {
    eventMuted: answers.eventMuted ?? (() => Promise.reject(new Error('not asked'))),
    muteEvent: answers.muteEvent ?? (() => Promise.reject(new Error('not asked'))),
  };
}

describe('Mute this event', () => {
  it('reads the member’s muted state', async () => {
    const state = await readMute(client({ eventMuted: () => Promise.resolve(true) }), 'e1');

    expect(state).toEqual({ status: 'loaded', muted: true, saving: false, unsaved: false });
  });

  it('did not load when the read fails, so the switch has no state to show', async () => {
    const state = await readMute(
      client({ eventMuted: () => Promise.reject(new Error('down')) }),
      'e1',
    );

    expect(state).toEqual({ status: 'failed' });
  });

  it('takes the saved state from the server', async () => {
    const sent: [string, boolean][] = [];
    const state = await saveMute(
      client({
        muteEvent: (eventId, muted) => {
          sent.push([eventId, muted]);
          return Promise.resolve(muted);
        },
      }),
      'e1',
      true,
    );

    expect(sent).toEqual([['e1', true]]);
    expect(state).toEqual({ status: 'loaded', muted: true, saving: false, unsaved: false });
  });

  it('puts the switch back and says so when a change does not save', async () => {
    const state = await saveMute(
      client({ muteEvent: () => Promise.reject(new Error('down')) }),
      'e1',
      true,
    );

    expect(state).toEqual({ status: 'loaded', muted: false, saving: false, unsaved: true });
  });
});
