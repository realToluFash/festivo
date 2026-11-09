import { vi } from 'vitest';

import { PHONE_WIDTH } from './phoneWidth.ts';

/** The window answers as a phone's browser does, 640 wide or narrower; restored with the suite's mocks. */
export function atPhoneWidth(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === PHONE_WIDTH,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as never,
  );
}
