import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useShowEventName, useShownEventName } from './EventNav.tsx';

describe("the band's crumb inside an event (sc-26270)", () => {
  it('names the event its page has loaded, and nothing once the page has gone', () => {
    const crumb = renderHook(({ id }) => useShownEventName(id), { initialProps: { id: 'e1' } });
    expect(crumb.result.current).toBeUndefined();

    const page = renderHook(({ name }) => useShowEventName('e1', name), {
      initialProps: { name: undefined as string | undefined },
    });
    expect(crumb.result.current).toBeUndefined();

    page.rerender({ name: 'Summer gala' });
    expect(crumb.result.current).toBe('Summer gala');

    crumb.rerender({ id: 'e2' });
    expect(crumb.result.current).toBeUndefined();

    crumb.rerender({ id: 'e1' });
    page.unmount();
    expect(crumb.result.current).toBeUndefined();
  });
});
