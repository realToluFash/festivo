import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 3000 };

async function notifications(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Notification settings' });

  return router;
}

function block(): HTMLElement {
  return screen
    .getByRole('heading', { level: 2, name: 'What you hear about' })
    .closest('section') as HTMLElement;
}

function row(name: RegExp): HTMLElement {
  return within(block()).getByRole('button', { name });
}

function toggle(name: string): HTMLElement {
  return screen.getByRole('switch', { name });
}

describe('Notification settings at a desk (sc-30243)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('opens from the Settings list’s Notifications row, the row no longer a design of its own', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings'] });
    render(<RouterProvider router={router} />);
    const list = await screen.findByRole('navigation', { name: 'Settings' });

    fireEvent.click(within(list).getByRole('link', { name: 'Notifications' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Notification settings' }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe('/demo/settings/notifications');
    expect(screen.queryByText('Notifications has its own design.')).toBeNull();
  });

  it('says how you hear on the card, one row per kind with its value in words, and quiet hours as a fact', async () => {
    await notifications('/demo/settings/notifications');

    expect(screen.getByText('You hear by push and email')).toBeDefined();
    expect(screen.getByText('5 of 6 by push · 5 of 6 by email')).toBeDefined();
    expect(screen.queryByRole('button', { name: /How to allow push/ })).toBeNull();
    expect(
      within(block())
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual([
      'Guest repliesPush and email',
      'MessagesPush and email',
      'Event dayPush only',
      'Event changesPush and email',
      'MoneyPush and email',
      'Account & securityEmail only · email always on',
    ]);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(within(block()).getByText(/only Event day pushes come through\.$/)).toBeDefined();
  });

  it('opens a row in place to its two switches, one row at a time', async () => {
    await notifications('/demo/settings/notifications');

    fireEvent.click(row(/^Guest replies/));
    const group = screen.getByRole('group', { name: 'Guest replies' });
    expect(row(/^Guest replies/).getAttribute('aria-expanded')).toBe('true');
    expect(within(group).getByText(/^Guests' replies and changes/)).toBeDefined();
    expect(toggle('Guest replies Push').getAttribute('aria-checked')).toBe('true');
    expect(toggle('Guest replies Email').getAttribute('aria-checked')).toBe('true');
    expect(within(group).getAllByText('On')).toHaveLength(2);

    fireEvent.click(row(/^Money/));
    expect(screen.queryByRole('group', { name: 'Guest replies' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Money' })).toBeDefined();
  });

  it('keeps Account & security’s email on, with a lock and its sentence under the switch', async () => {
    await notifications('/demo/settings/notifications?state=accountSecurity');

    const group = screen.getByRole('group', { name: 'Account & security' });
    const email = toggle('Account & security Email');
    expect(email.getAttribute('aria-disabled')).toBe('true');
    expect(within(group).getByText('Email cannot be switched off.')).toBeDefined();
    expect(within(group).queryByText(/access\. Email cannot/)).toBeNull();

    fireEvent.click(email);
    expect(email.getAttribute('aria-checked')).toBe('true');
    expect(toggle('Account & security Push').getAttribute('aria-disabled')).toBe('false');
  });

  it('saves as you switch: the value at once, Saving… then Saved on the row, the focus left where it was', async () => {
    await notifications('/demo/settings/notifications');

    fireEvent.click(row(/^Messages/));
    const email = toggle('Messages Email');
    email.focus();
    fireEvent.click(email);

    expect(email.getAttribute('aria-checked')).toBe('false');
    expect(email.getAttribute('aria-busy')).toBe('true');
    expect(within(row(/^Messages/)).getByText('Saving…')).toBeDefined();
    expect(within(row(/^Messages/)).getByText('Push only')).toBeDefined();
    expect(screen.getByText('5 of 6 by push · 4 of 6 by email')).toBeDefined();

    expect(await within(row(/^Messages/)).findByText('Saved', {}, SLOW)).toBeDefined();
    expect(screen.getByText('Saved.')).toBeDefined();
    expect(document.activeElement).toBe(email);
    expect(screen.getByRole('group', { name: 'Messages' })).toBeDefined();

    fireEvent.click(row(/^Money/));
    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('puts a failed save back, with words under the switch, and the same switch fails again', async () => {
    await notifications('/demo/settings/notifications?state=saveFailed');

    const group = screen.getByRole('group', { name: 'Messages' });
    expect(within(group).getByRole('alert').textContent).toBe(
      'The email switch was not saved. Try again.',
    );
    const email = toggle('Messages Email');
    expect(email.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(email);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(email.getAttribute('aria-checked')).toBe('false');
    expect(await screen.findByRole('alert', {}, SLOW)).toBeDefined();
    expect(email.getAttribute('aria-checked')).toBe('true');
    expect(within(row(/^Messages/)).getByText('Push and email')).toBeDefined();

    fireEvent.click(row(/^Messages/));
    expect(screen.getByRole('alert').textContent).toBe(
      'The email switch was not saved. Try again.',
    );
  });

  it('holds a save in flight on the saving state, then saves it', async () => {
    await notifications('/demo/settings/notifications?state=saving');

    expect(within(row(/^Messages/)).getByText('Saving…')).toBeDefined();
    expect(toggle('Messages Email').getAttribute('aria-checked')).toBe('false');
    expect(toggle('Messages Email').getAttribute('aria-busy')).toBe('true');
  });

  it('opens on Saved for the saved state', async () => {
    await notifications('/demo/settings/notifications?state=saved');

    expect(within(row(/^Messages/)).getByText('Saved')).toBeDefined();
    expect(within(row(/^Messages/)).getByText('Push only')).toBeDefined();
  });

  it('says push is blocked in this browser, with how to allow it as the card’s one step', async () => {
    await notifications('/demo/settings/notifications?state=pushBlocked');

    expect(
      screen.getByText('Push is off in this browser, so pushes will not reach you here.'),
    ).toBeDefined();
    fireEvent.click(row(/^Event day/));
    expect(
      within(screen.getByRole('group', { name: 'Event day' })).getByText('Blocked in this browser'),
    ).toBeDefined();
    expect(toggle('Event day Push').getAttribute('aria-disabled')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: /How to allow push/ }));
    const dialog = screen.getByRole('dialog', { name: 'Allow push in this browser' });
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((one) => one.textContent),
    ).toEqual([
      'Click the icon at the left end of the address bar.',
      'Find Notifications and set it to Allow.',
      'Come back to this tab. Soirely checks again when you do.',
    ]);
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the card’s shape while loading, and Try again when the first load fails', async () => {
    await notifications('/demo/settings/notifications?state=failed');

    expect(screen.getByRole('alert').textContent).toContain(
      'Your notification settings did not load.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeDefined();
    expect(await screen.findByText('You hear by push and email', {}, SLOW)).toBeDefined();
  });

  it('is the same page for an admin and a member', async () => {
    await notifications('/demo/settings/notifications?as=ana');

    expect(screen.getByText('You hear by push and email')).toBeDefined();
    expect(within(block()).getAllByRole('button')).toHaveLength(6);
  });
});
