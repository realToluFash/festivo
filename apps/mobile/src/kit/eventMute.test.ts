import { describe, expect, it } from 'vitest';

import {
  type HeldMute,
  type MutesEvents,
  answeredMute,
  readMute,
  saveMute,
  shownMute,
} from './eventMute.ts';

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
          return Promise.resolve({ muted, markedWhenMuted: ['messages'] });
        },
      }),
      'e1',
      true,
    );

    expect(sent).toEqual([['e1', true]]);
    expect(state).toEqual({
      state: { status: 'loaded', muted: true, saving: false, unsaved: false },
      saved: { muted: true, markedWhenMuted: ['messages'] },
    });
  });

  it('puts the switch back and says so when a change does not save', async () => {
    const state = await saveMute(
      client({ muteEvent: () => Promise.reject(new Error('down')) }),
      'e1',
      true,
    );

    expect(state).toEqual({
      state: { status: 'loaded', muted: false, saving: false, unsaved: true },
      saved: null,
    });
  });

  const muted = { status: 'loaded', muted: true, saving: false, unsaved: false } as const;
  const unmuted = { status: 'loaded', muted: false, saving: false, unsaved: false } as const;

  it('shows a switch moved to another event as loading until that event is read', () => {
    const held: HeldMute = { eventId: 'e1', state: muted };

    expect(shownMute(held, 'e1')).toEqual(muted);
    expect(shownMute(held, 'e2')).toEqual({ status: 'loading' });
  });

  it('drops a save answer for an event no longer shown', () => {
    const shown: HeldMute = { eventId: 'e2', state: unmuted };

    expect(answeredMute(shown, 'e1', muted)).toBe(shown);
    expect(answeredMute(shown, 'e2', muted)).toEqual({ eventId: 'e2', state: muted });
  });
});
