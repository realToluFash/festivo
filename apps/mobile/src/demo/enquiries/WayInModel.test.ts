import { describe, expect, it } from 'vitest';

import { listStateOf } from '../events/EventsModel.ts';
import { WAY_IN_STATES, WAY_IN_WORDS, wayInOf, wayInStateOf } from './WayInModel.ts';

describe('Events’ way into Enquiries', () => {
  it('shows the row on every state but Free', () => {
    expect(WAY_IN_STATES.filter((state) => !wayInOf(state).enterprise)).toEqual(['eventsFree']);
  });

  it('leaves the Events states that were already there as they were', () => {
    expect(WAY_IN_STATES.filter((state) => listStateOf(state) != null)).toEqual([]);
    expect(wayInStateOf('eventsOffline')).toBeNull();
    expect(wayInStateOf(undefined)).toBeNull();
  });

  it('reads the row in each of the four languages, with l10n’s nouns', () => {
    expect(wayInOf('wayInFr').language).toBe('fr');
    expect(wayInOf('wayInEs').language).toBe('es');
    expect(wayInOf('wayInPt').language).toBe('pt');
    expect(wayInOf('eventsEnterprise').language).toBe('en');
    expect(Object.values(WAY_IN_WORDS)).toEqual(['Enquiries', 'Consultas', 'Demandes', 'Pedidos']);
  });
});
