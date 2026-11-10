import { describe, expect, it } from 'vitest';

import { LONG_LEAD, cardFacts, cardStart, cardStateOf } from './PeopleCardModel.ts';
import { PEOPLE_VIEWERS, sampleOnEvent } from './PeopleSample.ts';

describe('the People card', () => {
  it('counts everyone on the event and names the Lead', () => {
    expect(cardFacts(sampleOnEvent(), PEOPLE_VIEWERS.julien)).toEqual({
      count: 5,
      lead: 'Priya Shah',
    });
  });

  it('calls the Lead You when the viewer leads', () => {
    const { onEvent, viewer } = cardStart('one');

    expect(cardFacts(onEvent, viewer)).toEqual({ count: 1, lead: 'You' });
  });

  it('has no Lead line when nobody leads, and nothing when nobody is on it', () => {
    const noLead = cardStart('noLead');

    expect(cardFacts(noLead.onEvent, noLead.viewer)).toEqual({ count: 4, lead: null });
    expect(cardFacts([], PEOPLE_VIEWERS.julien)).toEqual({ count: 0, lead: null });
  });

  it('shows a reader the same card and opens People read only', () => {
    const start = cardStart('readOnly');

    expect(cardFacts(start.onEvent, start.viewer)).toEqual(
      cardFacts(sampleOnEvent(), PEOPLE_VIEWERS.julien),
    );
    expect(start.href).toBe('/demo/people?state=readOnly');
  });

  it('names a long Lead in full', () => {
    const { onEvent, viewer } = cardStart('long');

    expect(cardFacts(onEvent, viewer).lead).toBe(LONG_LEAD);
  });

  it('reads an unknown state as the populated card', () => {
    expect(cardStateOf('nope')).toBeNull();
    expect(cardStart(null).href).toBe('/demo/people');
  });
});
