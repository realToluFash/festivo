import { describe, expect, it } from 'vitest';

import { announceMute, listenToMutes } from './eventMutes.ts';
import { type MuteState, heardMute } from './kit/eventMute.ts';

function switchFor(eventId: string): { state: () => MuteState; stop: () => void } {
  let state: MuteState = { status: 'loaded', muted: false, saving: false, unsaved: false };
  const stop = listenToMutes((changed, saved) => {
    state = heardMute(eventId, changed, saved) ?? state;
  });

  return { state: () => state, stop };
}

describe('Mute this event is one switch (sc-3980)', () => {
  it("the event page's switch follows a change saved from the bell's More", () => {
    const page = switchFor('e1');
    const other = switchFor('e2');

    announceMute('e1', { muted: true, markedWhenMuted: ['messages'] });

    expect(page.state()).toEqual({ status: 'loaded', muted: true, saving: false, unsaved: false });
    expect(other.state()).toEqual({
      status: 'loaded',
      muted: false,
      saving: false,
      unsaved: false,
    });
    page.stop();
    other.stop();
  });

  it('a switch no longer shown hears nothing', () => {
    const page = switchFor('e1');
    page.stop();

    announceMute('e1', { muted: true, markedWhenMuted: [] });

    expect(page.state()).toMatchObject({ muted: false });
  });
});
