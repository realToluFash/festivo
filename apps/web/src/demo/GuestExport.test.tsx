import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const SAFETY =
  'This file has guests’ personal details. Keep it somewhere safe, and delete it when you’re done.';

async function guests(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/guests?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog', { name: 'Export guests' });
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

afterEach(cleanup);

describe('Guests, Export at a desk (sc-3784)', () => {
  it('opens from Export beside Add guest, with This view and Excel chosen', SLOW, async () => {
    await guests('inUse');

    const add = screen.getByRole('button', { name: 'Add guest' });
    const button = screen.getByRole('button', { name: 'Export' });

    expect(button.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(button);

    const box = dialog();
    const view = within(box).getByRole('radio', { name: /^This view \(156 people\)/u });

    expect((view as HTMLInputElement).checked).toBe(true);
    expect(
      (within(box).getByRole('radio', { name: /^Excel \(\.xlsx\)/u }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(within(box).getByRole('radio', { name: /^All guests \(156 people\)/u })).toBeDefined();
    expect(within(box).getByText('Filter: All')).toBeDefined();
    expect(within(box).getByText(/ – guests – 2026-11-0\d\.xlsx$/u)).toBeDefined();
    expect(within(box).getByText('Allergies')).toBeDefined();
  });

  it('keeps the safety note directly above Download', SLOW, async () => {
    await guests('export');

    const download = within(dialog()).getByRole('button', { name: 'Download' });

    expect(download.previousElementSibling?.textContent).toBe(SAFETY);
  });

  it('names what narrows This view, and counts it in people', SLOW, async () => {
    await guests('exportNarrowed');

    const box = dialog();

    expect(within(box).getByText('Filter: Coming · search “duarte”')).toBeDefined();
    expect(within(box).getByRole('radio', { name: /^This view \(2 people\)/u })).toBeDefined();
  });

  it('turns This view off when the view is empty, and chooses All guests', SLOW, async () => {
    await guests('exportEmpty');

    const box = dialog();
    const view = within(box).getByRole('radio', { name: /^This view \(0 people\)/u });

    expect((view as HTMLInputElement).disabled).toBe(true);
    expect(within(box).getByText('Nothing in this view to export.')).toBeDefined();
    expect(
      (within(box).getByRole('radio', { name: /^All guests/u }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('renames the file as CSV when CSV is chosen', SLOW, async () => {
    await guests('export');

    fireEvent.click(within(dialog()).getByRole('radio', { name: /^CSV/u }));

    expect(within(dialog()).getByText(/ – guests – 2026-11-0\d\.csv$/u)).toBeDefined();
  });

  it('leaves allergies, diet and access out without guests.manage', SLOW, async () => {
    await guests('exportNoNeeds');

    const box = dialog();

    expect(within(box).queryByText('Allergies')).toBeNull();
    expect(within(box).queryByText('Diet')).toBeNull();
    expect(within(box).queryByText('Access')).toBeNull();
    expect(
      within(box).getByText(
        'Allergies, diet and access aren’t in this file, because seeing them needs permission to manage guests.',
      ),
    ).toBeDefined();
  });

  it('is busy while the file is made', SLOW, async () => {
    await guests('exportPreparing');

    const busy = within(dialog()).getByRole('button', { name: /Preparing the file…/u });

    expect(busy.getAttribute('aria-busy')).toBe('true');
  });

  it('stays open when the file could not be made, and Download tries again', SLOW, async () => {
    await guests('exportFailed');

    expect(within(dialog()).getByRole('alert').textContent).toBe(
      'The file could not be made, so nothing was downloaded. Try again.',
    );

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Download' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), WAIT);
    expect(
      await screen.findByText(/^Your file is ready\. Look in your downloads for .+\.xlsx\.$/u),
    ).toBeDefined();
  });

  it('shows no Export to Can view or Can check guests in', SLOW, async () => {
    await guests('exportGrantView');

    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });

  it('shows no Export before anyone is on the list', SLOW, async () => {
    await guests('first');

    expect(screen.queryByRole('button', { name: 'Export' })).toBeNull();
  });
});
