import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, WAIT);

  return router;
}

function status(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent)
    .join(' | ');
}

describe('door staff check guests in from a browser (sc-28230)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(cleanup);

  it('goes back to Your shift by an address, with no tab bar', SLOW, async () => {
    await open('/demo/check-in?state=list');

    expect(screen.getByRole('link', { name: 'Your shift' }).getAttribute('href')).toBe(
      '/demo/check-in/shift',
    );
    expect(screen.queryByRole('navigation')).toBeNull();
    cleanup();

    await open('/demo/check-in?state=list&holder=code');
    expect(screen.getByRole('link', { name: 'Joana & Rui’s wedding' }).getAttribute('href')).toBe(
      '/demo/redeem?state=from-check-in',
    );
    expect(screen.getByText('Joana & Rui’s wedding · Bar and drinks')).toBeDefined();
  });

  it('marks an arrival, says so as a status, and undoes it', SLOW, async () => {
    await open('/demo/check-in?state=searching');

    fireEvent.click(screen.getByRole('button', { name: `Arrived: ${ADAEZE}` }));

    expect(status()).toContain(`${ADAEZE} arrived at 19:42.`);
    expect(screen.getByText('Arrived at 19:42 · Bisi Adeyemi')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: `Undo arrival: ${ADAEZE}` }));

    expect(await screen.findByText('Arrival undone')).toBeDefined();
    expect(screen.getByRole('button', { name: `Arrived: ${ADAEZE}` })).toBeDefined();
  });

  it('offers a walk-in when nobody matches, and checks the name first', SLOW, async () => {
    await open('/demo/check-in?state=no_match');

    fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
    const sheet = screen.getByRole('dialog', { name: 'Add walk-in' });
    const field = within(sheet).getByLabelText('Full name');

    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: '  ' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add and mark arrived' }));
    expect(within(sheet).getByRole('alert').textContent).toBe('Enter their full name.');

    fireEvent.change(field, { target: { value: 'Kunle Adeyemi' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add and mark arrived' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(status()).toContain('Kunle Adeyemi added as a walk-in. Arrived at 19:42.');
    expect(screen.getByText('Walk-in')).toBeDefined();
  });

  it('offers to mark a name already on the list arrived', SLOW, async () => {
    await open('/demo/check-in?state=walk_in_duplicate');
    const sheet = screen.getByRole('dialog', { name: 'Add walk-in' });

    expect(within(sheet).getByText('Folasade Bello is already on the list')).toBeDefined();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Mark them arrived' }));

    expect(status()).toContain('Folasade Bello arrived at 19:42.');
  });

  it('records nothing while offline, and nothing is queued', SLOW, async () => {
    await open('/demo/check-in?state=offline');

    expect(screen.getByText('Offline · as of 19:45')).toBeDefined();
    expect(screen.getAllByText('Not recorded. Try again.').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Arrived: Ngozi Eze' }));
    expect(screen.queryByText('Arrived at 19:42 · Bisi Adeyemi')).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: 'Demo: the connection is back' }));
    expect(screen.queryByText('Offline · as of 19:45')).toBeNull();
    expect(screen.getByText('Arrived at 19:46 · Samuel Okafor')).toBeDefined();
  });

  it('adds no walk-in while offline, and the sheet says so', SLOW, async () => {
    await open('/demo/check-in?state=offline');

    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'Kunle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
    const sheet = screen.getByRole('dialog', { name: 'Add walk-in' });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add and mark arrived' }));

    expect(within(sheet).getByRole('alert').textContent).toBe('Not recorded. Try again.');
    expect(screen.queryByText('Walk-in')).toBeNull();
    expect(status()).not.toContain('added as a walk-in');
  });

  it(
    'keeps Tab inside the walk-in sheet, and a live arrival leaves focus where it is',
    SLOW,
    async () => {
      await open('/demo/check-in?state=live');

      fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'Kunle' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add walk-in' }));
      const sheet = screen.getByRole('dialog', { name: 'Add walk-in' });
      const cancel = within(sheet).getByRole('button', { name: 'Cancel' });

      cancel.focus();
      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(within(sheet).getByLabelText('Full name'));

      cancel.focus();
      const before = screen.getByText(/^\d+ of \d+ arrived$/).textContent;
      await waitFor(
        () => expect(screen.getByText(/^\d+ of \d+ arrived$/).textContent).not.toBe(before),
        WAIT,
      );
      expect(document.activeElement).toBe(cancel);
    },
  );

  it(
    'lands another device’s arrival without announcing it or touching the search',
    SLOW,
    async () => {
      await open('/demo/check-in?state=live');
      const search = screen.getByLabelText('Search by name');

      fireEvent.change(search, { target: { value: 'ngozi' } });
      await waitFor(
        () => expect(screen.getByText('Arrived at 19:44 · Samuel Okafor')).toBeDefined(),
        WAIT,
      );

      expect((search as HTMLInputElement).value).toBe('ngozi');
      expect(status()).not.toContain('Ngozi');
    },
  );

  it('reads only before check-in opens and once it has ended', SLOW, async () => {
    await open('/demo/check-in?state=before_open');
    expect(screen.getByText('Check-in opens at 16:00')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Arrived/ })).toBeNull();
    cleanup();

    await open('/demo/check-in?state=empty_closed');
    expect(screen.getByRole('heading', { name: 'Nobody is on the list yet' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add walk-in' })).toBeNull();
    cleanup();

    await open('/demo/check-in?state=ended');
    expect(screen.getByText('This event has ended.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Undo arrival/ })).toBeNull();
  });

  it('names nothing when not signed in, and offers a join code', SLOW, async () => {
    await open('/demo/check-in?state=not_signed_in');

    expect(screen.getByRole('heading', { name: 'Sign in from your link or code' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Enter a join code' })).toBeDefined();
    expect(screen.queryByText(/Joana|Adaeze|Bisi/)).toBeNull();
  });

  it(
    'replaces the list once access ends, and Can view goes back to the shift page',
    SLOW,
    async () => {
      await open('/demo/check-in?state=outside_window');
      expect(
        screen.getByText('This link is yours alone. Nothing stays on this device.'),
      ).toBeDefined();
      expect(screen.queryByText(ADAEZE)).toBeNull();
      cleanup();

      await open('/demo/check-in?state=level_view');
      expect(
        await screen.findByRole('heading', { name: 'Hi Bisi, you’re on tonight' }),
      ).toBeDefined();
      expect(screen.queryByRole('link', { name: 'Check-in' })).toBeNull();
    },
  );

  it('opens from the shift page and from You’re in at Can check guests in only', SLOW, async () => {
    await open('/demo/check-in/shift');
    expect(screen.getByRole('link', { name: 'Check-in' })).toBeDefined();
    cleanup();

    await open('/demo/redeem?state=browser-in');
    expect(screen.getByRole('link', { name: 'Check-in' }).getAttribute('href')).toBe(
      '/demo/check-in?state=list&holder=code',
    );
    expect(screen.getByRole('button', { name: 'Open the event' })).toBeDefined();
    cleanup();

    await open('/demo/redeem?state=browser-in-view');
    expect(screen.queryByRole('link', { name: 'Check-in' })).toBeNull();
  });
});
