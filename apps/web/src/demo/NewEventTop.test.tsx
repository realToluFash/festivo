import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('New event’s form at a desk (sc-48607)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => vi.useRealTimers());

  function open(state?: string) {
    const router = createMemoryRouter(routes, {
      initialEntries: [`/demo/events/new${state == null ? '' : `?state=${state}`}`],
    });
    render(<RouterProvider router={router} />);

    return router;
  }

  it('lays the fields out in today’s order, with the organisation’s zone and currency', async () => {
    open();

    const name = await screen.findByRole('textbox', { name: /Event name/ });
    const form = name.closest('form') as HTMLElement;
    const headings = within(form)
      .getAllByRole('heading', { level: 2 })
      .map((one) => one.textContent);

    expect(headings).toEqual([
      'About the event',
      'Hosted by',
      'Cover photo',
      'When',
      'Venue',
      'Time zone and currency',
    ]);
    expect((name as HTMLInputElement).value).toBe('');
    expect(screen.getByText('Filled in from Ire Events’s settings.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create event' })).toBeDefined();
  });

  it('refuses four fields at once, says so by the button and focuses Event name', async () => {
    open('refused');

    expect(await screen.findByText('4 fields need fixing, so nothing was sent.')).toBeDefined();
    expect(screen.getByText('Give the event a name.')).toBeDefined();
    expect(screen.getByText('Choose what kind of event it is.')).toBeDefined();
    expect(screen.getByText('Enter a name or remove this host.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /Event name/ }));
  });

  it('keeps the form when it was not created', async () => {
    open('notCreated');

    expect(await screen.findByText('Not created. Nothing was saved. Try again.')).toBeDefined();
    expect((screen.getByRole('textbox', { name: /Event name/ }) as HTMLInputElement).value).toBe(
      'Adaeze & Tunde’s wedding',
    );
  });

  it('shows the server’s refusal under Time zone', async () => {
    open('server');

    expect(await screen.findByText('Choose a time zone.')).toBeDefined();
  });

  it('creates, says so and opens the event', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = open('filled');

    fireEvent.click(await screen.findByRole('button', { name: 'Create event' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDefined();
    await act(async () => vi.advanceTimersByTimeAsync(1300));
    expect(screen.getByText('Created. Opening the event.')).toBeDefined();
    await act(async () => vi.advanceTimersByTimeAsync(1700));
    expect(router.state.location.pathname).toBe('/demo/events/evt-draft-4');
  });

  it('asks first when leaving with something typed', async () => {
    open('leave');

    expect(await screen.findByText('What you typed for this event will be lost.')).toBeDefined();
  });
});
