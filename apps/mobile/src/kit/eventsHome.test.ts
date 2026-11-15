import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { summaryWords } from './eventsHome.ts';

const t = ((key: string, values: Record<string, unknown> = {}) =>
  `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

describe('summaryWords', () => {
  it('joins the parts whose count is not 0, in order', () => {
    const join = ((key: string, values: Record<string, unknown> = {}) =>
      key === 'eventsScreen.summaryJoin'
        ? `${String(values.first)} · ${String(values.rest)}`
        : `${key.replace('eventsScreen.summary', '')} ${String(values.count)}`) as unknown as TFunction;

    expect(summaryWords({ happeningNow: 2, upcoming: 3, drafts: 1 }, join)).toBe(
      'HappeningNow 2 · Upcoming 3 · Drafts 1',
    );
    expect(summaryWords({ happeningNow: 0, upcoming: 3, drafts: 0 }, join)).toBe('Upcoming 3');
  });

  it('has nothing to say with nothing to count', () => {
    expect(summaryWords({ happeningNow: 0, upcoming: 0, drafts: 0 }, t)).toBeNull();
  });
});
