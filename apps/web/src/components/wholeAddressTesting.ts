import { afterEach, beforeEach } from 'vitest';

/** jsdom gives `<wbr>` and a span no display, so an accessible name gains a space at each; browsers give them the inline default, which reads as nothing (sc-91529). */
export function readAddressesInline(): void {
  const inline = document.createElement('style');
  inline.textContent = '.whole-address, .whole-address * { display: inline; }';

  beforeEach(() => {
    document.head.append(inline);
  });
  afterEach(() => {
    inline.remove();
  });
}
