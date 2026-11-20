import { describe, expect, it } from 'vitest';

import { cssRule, mediaBlock, stylesheet } from '../../../test-styles.ts';

const SHEET = stylesheet(import.meta.dirname, 'overviewReflow.css');
const AT_320 = mediaBlock('(width <= 40rem)', SHEET);

describe("an event's Overview at 400% zoom, 320 CSS px (sc-74933)", () => {
  it('changes nothing from 641 px up: every rule sits in the one narrow block', () => {
    expect(AT_320).not.toBe('');
    expect(SHEET.match(/@media/gu)).toHaveLength(1);
  });

  it('puts the right column under the left, one column the window’s width', () => {
    expect(cssRule('.event-overview .ev-columns', AT_320)).toContain(
      'grid-template-columns: minmax(0, 1fr);',
    );
  });

  it('gives an open part’s indent to its fields and keeps its accent rule', () => {
    const opened = cssRule('.event-overview .ev-opened', AT_320);

    expect(opened).toContain('margin-left: 0;');
    expect(opened).not.toContain('border');
  });

  it('keeps Cancel and Save side by side, wrapping only when a language is too long', () => {
    const actions = cssRule('.event-overview .ev-opened-actions', AT_320);

    expect(actions).toContain('flex-wrap: wrap;');
    expect(actions).not.toContain('flex-direction');
  });

  it('brings Save into view with room for its whole focus ring', () => {
    expect(cssRule('.event-overview .ev-opened-actions', AT_320)).toContain(
      'scroll-margin-block: var(--spaceSm);',
    );
  });

  it('puts each day above its time in Dates, and ends a long time zone in an ellipsis', () => {
    expect(cssRule('.event-overview .ev-when-pair', AT_320)).toContain('flex-direction: column;');
    expect(cssRule('.ev .event-overview .ev-select select', AT_320)).toMatch(
      /min-width: 0;\s+text-overflow: ellipsis;/u,
    );
  });

  it('stacks Show the latest version?’s actions in their reading order', () => {
    expect(
      cssRule('body:has(.event-overview .ev-save-said) .desk-ask-pair.actions-pair', AT_320),
    ).toMatch(/flex-direction: column;\s+align-items: flex-start;/u);
  });
});
