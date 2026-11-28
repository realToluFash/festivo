import { describe, expect, it } from 'vitest';

import { HANDOFF_EVENT, LONGEST_NAME, handoffAt, handoffOf, pageOf } from './handoff.ts';

const of = (query: string) => handoffOf(new URLSearchParams(query));

describe('the handoff’s rules (sc-55397)', () => {
  it('names the event and the area its page marks', () => {
    expect(of('area=seating')).toMatchObject({ name: 'Adaeze & Tunde’s wedding', area: 'seating' });
    expect(of('')).toMatchObject({ area: 'overview' });
  });

  it('shows New event with no event, and the run page with no area', () => {
    expect(of('state=new')).toEqual({ kind: 'new' });
    expect(of('state=no_area')).toMatchObject({ area: null, page: 'run' });
  });

  it('shows nothing for an event that is not there', () => {
    expect(of('event=evt-nowhere')).toBeNull();
  });

  it('carries a name of 120 characters, the most an event takes', () => {
    expect([...LONGEST_NAME]).toHaveLength(120);
    expect(of('state=long&area=menu')).toMatchObject({ name: LONGEST_NAME, area: 'menu' });
  });

  it('opens the page it stands in for', () => {
    const handoff = (query: string) => {
      const found = of(query);
      if (found == null) throw new Error(query);

      return pageOf(found);
    };

    expect(handoff('state=new')).toBe('/demo/events/new');
    expect(handoff('state=no_area')).toBe(`/demo/events/${HANDOFF_EVENT}/run`);
    expect(handoff('area=seating')).toBe(`/demo/events/${HANDOFF_EVENT}/seating`);
    expect(handoff('area=overview')).toBe(`/demo/events/${HANDOFF_EVENT}`);
  });

  it('opens another area’s handoff from Menu, keeping a long name long', () => {
    const long = new URLSearchParams('state=long&area=seating');
    const found = handoffOf(long);
    if (found == null) throw new Error('long');

    expect(handoffAt(found, 'guests', long)).toBe('/demo/handoff?state=long&area=guests');
  });
});
