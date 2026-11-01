import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PHONE_WIDTH } from '../phoneWidth.ts';
import { Choices } from './Choices.tsx';

function atPhoneWidth(phone: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: phone && query === PHONE_WIDTH,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

function pair() {
  render(
    <Choices>
      <button type="button">Keep it signed in</button>
      {false}
      <button type="button">Sign it out</button>
    </Choices>,
  );

  return {
    keep: screen.getByRole('button', { name: 'Keep it signed in' }),
    go: screen.getByRole('button', { name: 'Sign it out' }),
  };
}

describe('a row of choices (sc-23282)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('puts the dismissive choice first in a row', () => {
    atPhoneWidth(false);
    const { keep, go } = pair();

    expect(keep.compareDocumentPosition(go)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(keep.parentElement?.className).toBe('actions');
  });

  it('stacks at phone width with the confirming choice first in the markup, as it is seen', () => {
    atPhoneWidth(true);
    const { keep, go } = pair();

    expect(go.compareDocumentPosition(keep)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(go.parentElement?.className).toBe('actions actions-stacked');
  });
});
