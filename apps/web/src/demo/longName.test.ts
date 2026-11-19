import { EVENT_NAME_MAXIMUM } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { sampleEvent, resetSample } from './events.ts';
import { LONG_NAME, LONG_NAMED, nameSample, renamed } from './longName.ts';

describe('the long sample name', () => {
  it('is as long as an event name may be', () => {
    expect(LONG_NAME).toHaveLength(EVENT_NAME_MAXIMUM);
  });

  it('renames the sample event and gives its own name back', () => {
    resetSample();
    nameSample(true);
    expect(sampleEvent(LONG_NAMED)?.name).toBe(LONG_NAME);

    nameSample(false);
    expect(sampleEvent(LONG_NAMED)?.name).toBe('Ireti at 40');
  });

  it('replaces the name wherever a moment carries it, and nothing else', () => {
    const moment = {
      events: [{ event: { name: 'Ireti at 40', id: 1 } }],
      title: 'Ireti at 40 ends',
    };

    expect(renamed(moment, 'Ireti at 40', 'Long')).toEqual({
      events: [{ event: { name: 'Long', id: 1 } }],
      title: 'Ireti at 40 ends',
    });
  });
});
