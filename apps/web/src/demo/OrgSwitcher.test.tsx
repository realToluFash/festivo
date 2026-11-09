import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { startSwitcher } from './switcher.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const ASKS = 'Where are you working?';

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function opener(name: RegExp = /^Organisation: Ire Events/): Promise<HTMLElement> {
  return screen.findByRole('button', { name }, WAIT);
}

function menu(): HTMLElement | null {
  return screen.queryByRole('heading', { level: 2, name: ASKS });
}

function places(): HTMLElement[] {
  return within(screen.getByRole('listbox', { name: 'Your organisations' })).getAllByRole('option');
}

function names(): string[] {
  return places().map((place) => place.getAttribute('aria-label') ?? '');
}

describe('the organisation switcher in B · Places at a desk (sc-30323)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    startSwitcher(null);
  });

  it('opens from the button, and closes on Escape with focus back on it', SLOW, async () => {
    open('/demo/events?switcher=closed');
    const button = await opener();

    expect(button.getAttribute('aria-haspopup')).toBe('listbox');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toContain('2 invitations');
    expect(menu()).toBeNull();

    fireEvent.click(button);

    expect(menu()).not.toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(names()).toEqual([
      'Ire Events, Your role · Owner, Current',
      'Casa Lumen Eventos, Your role · Admin',
      'Atelier Céleste Réceptions et Mariages, Your role · Member',
    ]);
    expect(places()[0]?.getAttribute('aria-selected')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Celebraciones Alameda, Invitation · Member' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create an organisation' })).toBeDefined();
    expect(screen.queryByRole('searchbox', { name: 'Search organisations' })).toBeNull();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('closes on a click outside it, with focus back on the button', SLOW, async () => {
    open('/demo/events?switcher=closed');
    const button = await opener();

    fireEvent.click(button);
    fireEvent.mouseDown(screen.getByRole('main'));

    expect(menu()).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it('switches, says so, and puts the organisation on the button', SLOW, async () => {
    const router = open('/demo/events?switcher=closed');
    fireEvent.click(await opener());
    fireEvent.click(screen.getByRole('option', { name: /^Casa Lumen Eventos/ }));

    expect(menu()).toBeNull();
    expect(screen.getByText('Now working in Casa Lumen Eventos.')).toBeDefined();
    const button = await opener(/^Organisation: Casa Lumen Eventos, your role Admin/);
    expect(document.activeElement).toBe(button);

    const side = screen.getByRole('navigation', { name: 'Soirely' });
    fireEvent.click(within(side).getByRole('link', { name: 'Today' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/demo/today'));
    expect(await opener(/^Organisation: Casa Lumen Eventos/)).toBeDefined();
    expect(screen.queryByText('Now working in Casa Lumen Eventos.')).toBeNull();
  });

  it('stays put when the current organisation is picked', SLOW, async () => {
    open('/demo/events?switcher=closed');
    fireEvent.click(await opener());
    fireEvent.click(screen.getByRole('option', { name: /^Ire Events/ }));

    expect(menu()).toBeNull();
    expect(screen.queryByText(/^Now working in/)).toBeNull();
  });

  it('moves with the arrow keys, and Enter picks', SLOW, async () => {
    open('/demo/events?switcher=closed');
    const button = await opener();

    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const focused = (): string => document.activeElement?.getAttribute('aria-label') ?? '';

    expect(focused()).toBe('Ire Events, Your role · Owner, Current');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowRight' });
    expect(focused()).toBe('Casa Lumen Eventos, Your role · Admin');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'End' });
    expect(focused()).toBe('Atelier Céleste Réceptions et Mariages, Your role · Member');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Enter' });

    expect(menu()).toBeNull();
    expect(screen.getByText('Now working in Casa Lumen Eventos.')).toBeDefined();
  });

  it('heads a list of more than 15 with a search that ignores case and accents', SLOW, async () => {
    open('/demo/events?switcher=many');
    await opener();
    const field = screen.getByRole('searchbox', { name: 'Search organisations' });

    expect(places()).toHaveLength(18);

    fireEvent.change(field, { target: { value: 'EVENEMENTS' } });
    expect(names()).toEqual(['Maison Ondine Événements, Your role · Member']);

    fireEvent.change(field, { target: { value: 'eventos' } });
    expect(names().map((name) => name.split(',')[0])).toEqual([
      'Casa Lumen Eventos',
      'Eventos Mar Azul',
      'Atlântico Comunicações e Eventos',
    ]);
    expect(await screen.findByText('3 organisations match')).toBeDefined();

    fireEvent.change(field, { target: { value: 'Belém' } });
    expect(screen.getByText('No organisation matches “Belém”.')).toBeDefined();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Create an organisation' })).toBeDefined();

    const clears = screen.getAllByRole('button', { name: 'Clear search' });
    fireEvent.click(clears[clears.length - 1] ?? field);

    expect(places()).toHaveLength(18);
    expect((field as HTMLInputElement).value).toBe('');
    expect(document.activeElement).toBe(field);
  });

  it('opens the search and no-match states as typed', SLOW, async () => {
    open('/demo/events?switcher=search');
    await opener();
    const field = screen.getByRole('searchbox', { name: 'Search organisations' });

    expect((field as HTMLInputElement).value).toBe('even');
    expect(places()).toHaveLength(6);
    expect(document.activeElement).toBe(field);
  });

  it('opens no-match with the line and a way to clear it', SLOW, async () => {
    open('/demo/events?switcher=no-match');
    await opener();

    expect(screen.getByText('No organisation matches “Belém”.')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Clear search' })).toHaveLength(2);
  });

  it('has no search, invitations or offer with one organisation', SLOW, async () => {
    open('/demo/events?switcher=one');
    const button = await opener();

    expect(button.textContent).not.toContain('invitation');
    expect(names()).toEqual(['Ire Events, Your role · Owner, Current']);
    expect(screen.queryByRole('searchbox', { name: 'Search organisations' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Invitation ·/ })).toBeNull();
  });

  it('accepts an invitation in place, then opens it', SLOW, async () => {
    open('/demo/events?switcher=invitation');
    await opener();
    const panel = screen.getByRole('group', { name: 'Celebraciones Alameda' });

    expect(within(panel).getByText('Invitation from Kemi Adeyemi · Member')).toBeDefined();
    expect(within(panel).getByText('Works until Fri, Nov 20')).toBeDefined();

    fireEvent.click(
      within(panel).getByRole('button', { name: 'Accept and join Celebraciones Alameda' }),
    );

    const joined = screen.getByText('You joined Celebraciones Alameda as Member.');
    expect(document.activeElement).toBe(joined.closest('[data-lands]'));
    expect(names()).toContain('Celebraciones Alameda, Your role · Member');
    expect(await opener(/1 invitation waiting$/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Open Celebraciones Alameda' }));

    expect(menu()).toBeNull();
    expect(screen.getByText('Now working in Celebraciones Alameda.')).toBeDefined();
  });

  it('declines an invitation in place', SLOW, async () => {
    open('/demo/events?switcher=invitation');
    await opener();
    fireEvent.click(
      screen.getByRole('button', { name: 'Decline the invitation to Celebraciones Alameda' }),
    );

    expect(screen.getByText('You declined. Kemi Adeyemi will see that you said no.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Accept and join/ })).toBeNull();
    expect(await opener(/1 invitation waiting$/)).toBeDefined();
  });

  it('opens the joined, declined and failed answers as the board draws them', SLOW, async () => {
    open('/demo/events?switcher=joined');
    await opener();
    expect(screen.getByText('You joined Celebraciones Alameda as Member.')).toBeDefined();
    cleanup();

    open('/demo/events?switcher=declined');
    expect(
      await screen.findByText('You declined. Beatriz Lima will see that you said no.'),
    ).toBeDefined();
    cleanup();

    open('/demo/events?switcher=failed');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Your answer did not reach us.');
    expect(
      screen.getByRole('button', { name: 'Accept and join Bluebird Gatherings' }),
    ).toBeDefined();
  });

  it('asks to join the offer, or puts it away with Not now', SLOW, async () => {
    open('/demo/events?switcher=offer');
    await opener();
    const panel = screen.getByRole('group', { name: 'Ire Weddings uses Soirely' });

    fireEvent.click(within(panel).getByRole('button', { name: 'Ask to join Ire Weddings' }));
    expect(within(panel).getByText(/Waiting for approval/)).toBeDefined();
    expect(within(panel).queryByRole('button', { name: 'Not now' })).toBeNull();

    cleanup();
    open('/demo/events?switcher=offer');
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(screen.queryByRole('button', { name: 'Ire Weddings, You can ask to join' })).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Celebraciones Alameda, Invitation · Member',
    );
  });

  it('opens the asked and unavailable offers', SLOW, async () => {
    open('/demo/events?switcher=offer-asked');
    await opener();
    expect(screen.getByText(/Waiting for approval/)).toBeDefined();
    cleanup();

    open('/demo/events?switcher=offer-unavailable');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'You cannot ask to join that organisation. Start your own, or ask somebody there to invite you.',
    );
  });

  it('opens the walk from Create an organisation, on its name', SLOW, async () => {
    open('/demo/events?switcher=populated');
    await opener();
    fireEvent.click(screen.getByRole('button', { name: 'Create an organisation' }));

    expect(menu()).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Create an organisation' })).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Organisation name')),
    );
  });

  it('marks nothing current while access is paused, and switches away from it', SLOW, async () => {
    open('/demo/events?switcher=paused');
    await opener();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /^Your access to Casa Lumen Eventos is paused/,
      }),
    ).toBeDefined();
    expect(places().filter((place) => place.getAttribute('aria-selected') === 'true')).toHaveLength(
      0,
    );

    fireEvent.keyDown(document.body, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Switch organisation' }));

    expect(menu()).not.toBeNull();
    expect(document.activeElement?.getAttribute('role')).toBe('option');

    fireEvent.click(screen.getByRole('option', { name: /^Atelier Céleste/ }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Events' })).toBeDefined();
    expect(
      screen.getByText('Now working in Atelier Céleste Réceptions et Mariages.'),
    ).toBeDefined();
  });
});
