import { describe, expect, it } from 'vitest';

import { CARD_FAILED, cardSays, cardStateOf } from './PeopleCardModel.ts';
import { peopleStart, peopleStateOf } from './PeopleSample.ts';

describe('the People card on Overview', () => {
  it('counts everyone on the event and names the lead', () => {
    expect(cardSays('people')).toEqual({
      title: '5 on this event',
      line: 'Lead · Priya Shah',
      label: '5 on this event. Lead, Priya Shah. Opens People.',
      href: '/demo/people',
    });
  });

  it('says You when you lead it alone', () => {
    expect(cardSays('alone')).toMatchObject({
      title: '1 on this event',
      line: 'Lead · You',
      label: '1 on this event. You lead it. Opens People.',
    });
  });

  it('has no second line when nobody leads it', () => {
    expect(cardSays('noLead')).toMatchObject({ title: '4 on this event', line: null });
    expect(cardSays('noLead').label).toBe('4 on this event. Opens People.');
  });

  it('says nobody is on a new event, and still opens People', () => {
    expect(cardSays('nobody')).toEqual({
      title: 'Nobody is on this event yet.',
      line: null,
      label: 'Nobody is on this event yet. Opens People.',
      href: '/demo/people?state=nobody',
    });
  });

  it('reads the same for someone who can only read People, and opens it read only', () => {
    expect(cardSays('readOnly')).toEqual({
      ...cardSays('people'),
      href: '/demo/people?state=readOnly',
    });
  });

  it('opens People on a page that agrees with its count', () => {
    for (const state of ['people', 'alone', 'noLead', 'nobody', 'readOnly'] as const) {
      const opened = new URLSearchParams(cardSays(state).href.split('?')[1] ?? '').get('state');
      const count = peopleStart(peopleStateOf(opened ?? undefined)).onEvent.length;

      expect(cardSays(state).title.startsWith(count === 0 ? 'Nobody' : `${count} `)).toBe(true);
    }
  });

  it('reads its state from the link', () => {
    expect(cardStateOf('failed')).toBe('failed');
    expect(cardStateOf('alone')).toBe('alone');
    expect(cardStateOf(undefined)).toBeNull();
    expect(cardStateOf('roleFails')).toBeNull();
  });

  it('words its failure', () => {
    expect(CARD_FAILED).toBe('We couldn’t load who’s on this event.');
  });
});
