import { describe, expect, it } from 'vitest';

import {
  BLUEBIRD,
  CELEBRACIONES,
  OFFER,
  PAUSED,
  SEARCH_FROM,
  SWITCHER_PAGES,
  SWITCHER_STATES,
  columnsOf,
  currentPlace,
  fold,
  holds,
  isSwitcherState,
  matchesLine,
  noMatchLine,
  openerLabel,
  openingOf,
  stepTo,
  waiting,
  whereOf,
} from './switcher.ts';

describe('the organisation switcher’s sample (sc-30323)', () => {
  it('knows every state the demo home links to, and nothing else', () => {
    const linked = SWITCHER_PAGES.flatMap((group) => group.states.map((state) => state.to));

    expect(linked).toEqual(SWITCHER_STATES.map((state) => `/demo/events?switcher=${state}`));
    expect(isSwitcherState('populated')).toBe(true);
    expect(isSwitcherState('everything')).toBe(false);
    expect(isSwitcherState(null)).toBe(false);
  });

  it('starts at Ire Events with two invitations waiting', () => {
    const where = whereOf('populated');

    expect(currentPlace(where).name).toBe('Ire Events');
    expect(where.places.map((place) => place.name)).toEqual([
      'Ire Events',
      'Casa Lumen Eventos',
      'Atelier Céleste Réceptions et Mariages',
    ]);
    expect(waiting(where).map((one) => one.id)).toEqual([CELEBRACIONES, BLUEBIRD]);
    expect(where.offer).toBeNull();
    expect(where.paused).toBe(false);
  });

  it('holds more than 15 only in the states that show the search', () => {
    for (const state of ['many', 'search', 'no-match'] as const) {
      expect(whereOf(state).places.length).toBeGreaterThan(SEARCH_FROM);
    }
    for (const state of ['populated', 'one', 'offer', 'invitation', 'paused'] as const) {
      expect(whereOf(state).places.length).toBeLessThanOrEqual(SEARCH_FROM);
    }
    expect(whereOf('one').places).toHaveLength(1);
  });

  it('answers each invitation and the offer as its state names', () => {
    const joined = whereOf('joined');

    expect(joined.places.map((place) => place.id)).toContain(CELEBRACIONES);
    expect(waiting(joined).map((one) => one.id)).toEqual([BLUEBIRD]);
    expect(whereOf('declined').answers[BLUEBIRD]).toBe('declined');
    expect(waiting(whereOf('declined')).map((one) => one.id)).toEqual([CELEBRACIONES]);
    expect(waiting(whereOf('failed')).map((one) => one.id)).toEqual([CELEBRACIONES, BLUEBIRD]);
    expect(whereOf('offer').offer).toBe('unasked');
    expect(whereOf('offer-asked').offer).toBe('asked');
    expect(whereOf('offer-unavailable').offer).toBe('unavailable');
    expect(whereOf('paused').paused).toBe(true);
  });

  it('opens each state with its panel and its search', () => {
    expect(openingOf('offer-asked')).toEqual({ panel: OFFER.id, query: '' });
    expect(openingOf('joined')).toEqual({ panel: CELEBRACIONES, query: '' });
    expect(openingOf('failed')).toEqual({ panel: BLUEBIRD, query: '' });
    expect(openingOf('search')).toEqual({ panel: null, query: 'even' });
    expect(openingOf('no-match')).toEqual({ panel: null, query: 'Belém' });
    expect(openingOf('paused').panel).toBeNull();
    expect(PAUSED.name).toBe('Casa Lumen Eventos');
  });

  it('narrows by name, ignoring case and accents', () => {
    expect(fold('Maison Ondine Événements')).toBe('maison ondine evenements');
    expect(holds('Maison Ondine Événements', 'EVEN')).toBe(true);
    expect(holds('Atlântico Comunicações e Eventos', 'comunicacoes')).toBe(true);
    expect(holds('Ire Events', '  ire ')).toBe(true);
    expect(holds('Ire Events', 'Belém')).toBe(false);

    const many = whereOf('many').places.filter((place) => holds(place.name, 'even'));
    expect(many.map((place) => place.name)).toEqual([
      'Ire Events',
      'Casa Lumen Eventos',
      'Maison Ondine Événements',
      'Eventos Mar Azul',
      'Thornbury Hall Events',
      'Atlântico Comunicações e Eventos',
    ]);
  });

  it('says what the search found', () => {
    expect(matchesLine(1)).toBe('1 organisation matches');
    expect(matchesLine(6)).toBe('6 organisations match');
    expect(noMatchLine(' Belém ')).toBe('No organisation matches “Belém”.');
  });

  it('lays out 4 places to a row at 500, and fewer as the window narrows', () => {
    expect(columnsOf(500 - 2 - 24)).toBe(4);
    expect(columnsOf(360 - 24 - 2 - 24)).toBe(2);
    expect(columnsOf(112)).toBe(1);
    expect(columnsOf(0)).toBe(4);
  });

  it('moves through the grid with the arrows, Home and End', () => {
    expect(stepTo('ArrowRight', 0, 6, 4)).toBe(1);
    expect(stepTo('ArrowRight', 5, 6, 4)).toBe(5);
    expect(stepTo('ArrowLeft', 0, 6, 4)).toBe(0);
    expect(stepTo('ArrowDown', 1, 6, 4)).toBe(5);
    expect(stepTo('ArrowDown', 3, 6, 4)).toBe(5);
    expect(stepTo('ArrowDown', 5, 6, 4)).toBe(5);
    expect(stepTo('ArrowUp', 5, 6, 4)).toBe(1);
    expect(stepTo('ArrowUp', 2, 6, 4)).toBe(2);
    expect(stepTo('Home', 4, 6, 4)).toBe(0);
    expect(stepTo('End', 0, 6, 4)).toBe(5);
    expect(stepTo('a', 0, 6, 4)).toBeNull();
  });

  it('names the button with its organisation, its role and what waits', () => {
    const where = whereOf('populated');

    expect(openerLabel(currentPlace(where), waiting(where).length)).toBe(
      'Organisation: Ire Events, your role Owner. Switch organisation. 2 invitations waiting',
    );
    expect(openerLabel(currentPlace(whereOf('one')), 0)).toBe(
      'Organisation: Ire Events, your role Owner. Switch organisation',
    );
  });
});
