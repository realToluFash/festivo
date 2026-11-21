import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WEDDING = 'Adaeze & Tunde’s wedding';
const MOVED = 'Now working in Casa Lumen Eventos.';

function open(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4?link=${state}`],
  });
  render(<RouterProvider router={router} />);

  return router;
}

const pill = (name: string) =>
  screen.getByRole('button', { name: new RegExp(`^Organisation: ${name}`, 'u') });

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

describe('An event’s link from another organisation, sc-80863', () => {
  it(
    'moves into Casa Lumen Eventos once the event has loaded, said under the crumb without focus',
    SLOW,
    async () => {
      open('moved');
      await screen.findByRole('button', { name: /^Organisation: Ire Events/u }, { timeout: 8000 });
      expect(document.querySelector('.skeleton[aria-busy="true"]')).not.toBeNull();
      expect(screen.queryByText(MOVED)).toBeNull();

      await screen.findByRole('heading', { level: 1, name: WEDDING }, { timeout: 8000 });
      const notice = await screen.findByText(MOVED);
      expect(pill('Casa Lumen Eventos')).toBeTruthy();
      expect(notice.closest('.sw-switched')?.contains(document.activeElement)).toBe(false);

      const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
      fireEvent.click(within(crumb).getByRole('link', { name: 'Events' }));
      await screen.findByRole('heading', { level: 1, name: 'Events' }, { timeout: 8000 });
      expect(pill('Casa Lumen Eventos')).toBeTruthy();
    },
  );

  it('says it is not available, and stays in Ire Events', SLOW, async () => {
    open('unavailable');
    await screen.findByRole(
      'heading',
      { level: 1, name: 'This event is not available' },
      { timeout: 8000 },
    );
    expect(pill('Ire Events')).toBeTruthy();
    expect(screen.queryByText(MOVED)).toBeNull();
  });

  it('stays in Ire Events while it fails, and moves once Try again loads it', SLOW, async () => {
    open('failed');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }, { timeout: 8000 }));
    expect(pill('Ire Events')).toBeTruthy();
    await screen.findByText(MOVED, undefined, { timeout: 8000 });
  });

  it('opens an event of the organisation already worked in with no notice', SLOW, async () => {
    open('same');
    await screen.findByRole('heading', { level: 1, name: WEDDING }, { timeout: 8000 });
    expect(pill('Ire Events')).toBeTruthy();
    expect(screen.queryByText(MOVED)).toBeNull();
  });
});
