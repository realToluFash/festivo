import { ApiError, type Violation } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { firstFew, refusedHandTo } from './handover.ts';

function refusal(status: number, violations: Violation[] = []) {
  const problem = { type: 'about:blank', title: 'No.', status, violations };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status }));
}

const led = (count: number) =>
  Array.from({ length: count }, (_, at) => ({ id: `e${at}`, title: `Event ${at}` }));

describe('what will move', () => {
  it('shows the first five as the API ordered them, then how many more', () => {
    const { shown, more } = firstFew(led(7));

    expect(shown.map(({ id }) => id)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
    expect(more).toBe(2);
  });

  it('shows them all, with nothing more, at five or fewer', () => {
    expect(firstFew(led(5))).toEqual({ shown: led(5), more: 0 });
    expect(firstFew(led(1)).more).toBe(0);
  });
});

describe('a removal naming nobody', () => {
  it('is read as the refusal only when handTo is the field refused', () => {
    expect(
      refusedHandTo(
        refusal(422, [
          {
            propertyPath: 'handTo',
            message: 'Choose who takes over their events.',
            code: 'choose_recipient',
          },
        ]),
      ),
    ).toBe(true);
    expect(
      refusedHandTo(refusal(422, [{ propertyPath: 'name', message: 'No.', code: 'blank' }])),
    ).toBe(false);
    expect(refusedHandTo(refusal(409))).toBe(false);
    expect(refusedHandTo(new Error('offline'))).toBe(false);
  });
});
