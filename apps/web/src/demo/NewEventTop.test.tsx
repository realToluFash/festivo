import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

describe('New event’s top at a desk, once the band has gone (sc-39509)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('draws the crumb back to Events with the one bell, then the title as the page’s heading', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/events/new'] });
    render(<RouterProvider router={router} />);

    const title = await screen.findByRole('heading', { level: 1, name: 'New event' });
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const row = crumb.parentElement as HTMLElement;

    expect(title).toBeDefined();
    expect(within(crumb).getByRole('link', { name: 'Events' }).getAttribute('href')).toBe(
      '/demo/events',
    );
    expect(within(row).getAllByRole('button', { name: /Notifications/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /Notifications/ })).toHaveLength(1);
  });

  it('opens from the Events list’s New event', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/events'] });
    render(<RouterProvider router={router} />);

    fireEvent.click(await screen.findByRole('button', { name: /New event/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'New event' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/events/new');
  });
});
