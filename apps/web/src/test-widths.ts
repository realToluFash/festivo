import { vi } from 'vitest';

import { PHONE_WIDTH, STACKED_WIDTH } from './phoneWidth.ts';

/** The window answers as a phone's browser does, 640 wide or narrower, and so stacked too; restored with the suite's mocks. */
export function atPhoneWidth(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === PHONE_WIDTH || query === STACKED_WIDTH,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as never,
  );
}

/** The window answers as a tablet's does, wider than a phone and 960 wide or narrower; restored with the suite's mocks. */
export function atStackedWidth(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === STACKED_WIDTH,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as never,
  );
}
