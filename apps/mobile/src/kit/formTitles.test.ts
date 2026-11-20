import { describe, expect, it } from 'vitest';

import { formTitles } from './formTitles.ts';

describe('formTitles', () => {
  it("keeps Duplicate in a phone's header and puts the event's name at the top of the form", () => {
    expect(formTitles('phone', 'Duplicate Summer gala', 'Duplicate', 'Events')).toEqual({
      bar: 'Duplicate',
      heading: 'Duplicate Summer gala',
    });
  });

  it('shows Duplicate once on a phone while the event loads', () => {
    expect(formTitles('phone', 'Duplicate', 'Duplicate', 'Events')).toEqual({
      bar: 'Duplicate',
      heading: null,
    });
  });

  it("keeps New event and Edit details in a phone's header", () => {
    expect(formTitles('phone', 'New event', undefined, 'Events')).toEqual({
      bar: 'New event',
      heading: null,
    });
  });

  it.each(['tabletPortrait', 'tabletLandscape'] as const)(
    'keeps Events in the header on %s and opens the form with the title',
    (kind) => {
      expect(formTitles(kind, 'Duplicate Summer gala', 'Duplicate', 'Events')).toEqual({
        bar: 'Events',
        heading: 'Duplicate Summer gala',
      });
    },
  );
});
