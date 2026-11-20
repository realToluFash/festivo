import { describe, expect, it } from 'vitest';

import { cssRule, mediaBlock, stylesheet } from '../test-styles.ts';
import { EVENTS_PAGES } from './events.ts';

const SHEET = stylesheet(import.meta.dirname, 'overviewReflow.css');
const AT_320 = mediaBlock('(width <= 40rem)', SHEET);

describe("an event's Overview at 400% zoom, 320 CSS px (sc-74933)", () => {
  it('changes nothing from 641 px up: every rule sits in the one narrow block', () => {
    expect(AT_320).not.toBe('');
    expect(SHEET.match(/@media/gu)).toHaveLength(1);
  });

  it('stacks the event’s sidebar above the page, one column, the page scrolling with the window', () => {
    expect(cssRule('.today.desk:has(.ev-overview)', AT_320)).toContain('flex-direction: column;');
    expect(cssRule('.today.desk:has(.ev-overview) .today-side', AT_320)).toContain('width: auto;');
    expect(cssRule('.ev-overview .ev-columns', AT_320)).toContain(
      'grid-template-columns: minmax(0, 1fr);',
    );
  });

  it('keeps Cancel and Save side by side, wrapping only when a language is too long', () => {
    expect(cssRule('.ev-overview .ev-opened-actions', AT_320)).toContain('flex-wrap: wrap;');
  });

  it('brings Save into view with room for its whole focus ring', () => {
    expect(SHEET).toContain('scroll-margin-block: var(--spaceSm);');
  });

  it('puts each day above its time in Dates', () => {
    expect(cssRule('.ev-overview .ev-when-pair', AT_320)).toContain('flex-direction: column;');
  });

  it('stacks Show the latest version?’s actions in their reading order', () => {
    expect(
      cssRule('body:has(.ev-overview .ev-save-said) .desk-ask-pair.actions-pair', AT_320),
    ).toMatch(/flex-direction: column;\s+align-items: flex-start;/u);
  });

  it('lists the states the story is checked against on the demo’s home', () => {
    const group = EVENTS_PAGES.find((one) => one.name.endsWith('(sc-74933)'));
    const states = group?.states.map((one) =>
      new URL(one.to, 'http://demo').searchParams.get('state'),
    );

    expect(states).toEqual([
      'live',
      'nameNotSaved',
      'nameForbidden',
      'nameChangedElsewhere',
      'currencyNotSaved',
      'currencyForbidden',
      'currencyChangedElsewhere',
      'hostsSix',
      'dates',
      'showLatest',
    ]);
  });
});
