import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StillSignedIn } from './StillSignedIn.tsx';

describe('StillSignedIn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('brings itself into view again once the fonts have arrived', async () => {
    let arrived = (): void => {};
    vi.spyOn(document.fonts, 'ready', 'get').mockReturnValue(
      new Promise((resolve) => {
        arrived = () => resolve(document.fonts);
      }),
    );
    const inView = vi.spyOn(Element.prototype, 'scrollIntoView');

    render(<StillSignedIn />);

    expect(screen.getByRole('alert').textContent).toContain('You are still signed in');
    expect(inView).toHaveBeenCalledTimes(1);

    arrived();

    await waitFor(() => expect(inView).toHaveBeenCalledTimes(2));
    expect(inView).toHaveBeenLastCalledWith({ block: 'nearest' });
  });
});
