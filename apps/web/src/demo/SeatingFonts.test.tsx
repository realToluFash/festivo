import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useFontsArrived } from './seatingText.ts';

describe("The room's caption is measured again once its font arrives (sc-92246)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws once more when the fonts are ready', async () => {
    let arrived = (): void => {};
    vi.spyOn(document.fonts, 'ready', 'get').mockReturnValue(
      new Promise((resolve) => {
        arrived = () => resolve(document.fonts);
      }),
    );
    let draws = 0;

    renderHook(() => {
      draws += 1;
      useFontsArrived();
    });
    const before = draws;

    arrived();

    await waitFor(() => expect(draws).toBe(before + 1));
  });
});
