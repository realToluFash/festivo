import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };

async function guests(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/guests?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Guests' }, WAIT);
}

function column(): HTMLElement {
  return screen.getByRole('main').querySelector<HTMLElement>('.gs-column') as HTMLElement;
}

function needs(name: RegExp = /^Needs/u): HTMLElement {
  return within(column()).getByRole('button', { name });
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

afterEach(cleanup);

describe('Guests, Needs recorded as facts (sc-3777)', () => {
  it('is collapsed and says so when nothing is recorded', SLOW, async () => {
    await guests('add');

    expect(needs().getAttribute('aria-expanded')).toBe('false');
    expect(needs().textContent).toContain('None recorded');
    expect(
      within(column()).getByText('None recorded. Open it to note allergies, diet or access needs.'),
    ).toBeDefined();

    fireEvent.click(needs());

    expect(needs().getAttribute('aria-expanded')).toBe('true');
    for (const legend of ['Allergies', 'Diet', 'Access']) {
      expect(
        within(column()).getByRole('group', { name: new RegExp(`^${legend}`, 'u') }),
      ).toBeDefined();
    }
    expect(within(column()).getByRole('textbox', { name: /^Private note/u })).toBeDefined();
  });

  it('lists the 14 allergens in the regulation’s order, then Other allergy', SLOW, async () => {
    await guests('needsOpen');
    const allergies = within(column()).getByRole('group', { name: /^Allergies/u });
    const boxes = within(allergies).getAllByRole('checkbox');

    expect(boxes).toHaveLength(15);
    expect(boxes[0]?.closest('label')?.textContent).toBe('Cereals containing gluten');
    expect(boxes[14]?.closest('label')?.textContent).toBe('Other allergy');
  });

  it('collapses what is recorded to its words, allergies first, never the note', SLOW, async () => {
    await guests('needsFilled');
    const chips = within(column())
      .getAllByRole('listitem')
      .map((one) => one.textContent);

    expect(needs().textContent).toContain('5 noted');
    expect(chips).toEqual([
      '!Allergy · Peanuts',
      '!Allergy · Sesame',
      'Halal',
      'Step-free access',
      'Private note',
    ]);
    expect(within(column()).queryByText(/adrenaline/u)).toBeNull();
  });

  it('refuses Other ticked with no words, beside it, and nothing is added', SLOW, async () => {
    await guests('needsOtherBlank');
    const field = within(column()).getByRole('textbox', { name: 'Which allergy?' });

    expect(screen.getByText('One field needs fixing. Nothing was saved.')).toBeDefined();
    expect(within(column()).getByText('Say which')).toBeDefined();
    expect(field.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(field, { target: { value: 'Kiwi' } });

    expect(within(column()).queryByText('Say which')).toBeNull();
    expect(screen.queryByText('One field needs fixing. Nothing was saved.')).toBeNull();
    expect(field.isConnected).toBe(true);
  });

  it('refuses an Other over 100 characters and a note over 500', SLOW, async () => {
    await guests('needsOtherLong');

    expect(within(column()).getByText('Shorten it to 100 characters or fewer.')).toBeDefined();
    cleanup();
    await guests('needsNoteLong');

    expect(
      within(column()).getByText('Shorten the note to 500 characters or fewer.'),
    ).toBeDefined();
    expect(
      within(column())
        .getByRole('textbox', { name: /^Private note/u })
        .getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('opens a collapsed section and focuses the field that failed', SLOW, async () => {
    await guests('add');

    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Bimpe Adeyemi' },
    });
    fireEvent.click(needs());
    fireEvent.click(within(column()).getByRole('checkbox', { name: 'Other diet' }));
    fireEvent.click(needs());
    expect(needs().getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));

    expect(needs().getAttribute('aria-expanded')).toBe('true');
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(column()).getByRole('textbox', { name: 'Which diet?' }),
      ),
    );
    expect(screen.queryByText('Bimpe Adeyemi added.')).toBeNull();
  });

  it('gives each companion their own needs', SLOW, async () => {
    await guests('needsCompanion');
    const theirs = needs(/^Their needs/u);

    expect(theirs.getAttribute('aria-expanded')).toBe('true');
    expect(needs().getAttribute('aria-expanded')).toBe('false');
    expect(
      (within(column()).getByRole('checkbox', { name: 'Milk' }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('says where the needs went once a guest is added with them', SLOW, async () => {
    await guests('add');

    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Bimpe Adeyemi' },
    });
    fireEvent.click(needs());
    fireEvent.click(within(column()).getByRole('checkbox', { name: 'Peanuts' }));
    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));

    expect(
      screen.getByText('Bimpe Adeyemi added. Their needs are on the list under Dietary.'),
    ).toBeDefined();
    expect(needs().textContent).toContain('None recorded');
  });

  it('keeps adding a guest with no needs as before', SLOW, async () => {
    await guests('add');

    fireEvent.change(screen.getByRole('textbox', { name: 'Full name' }), {
      target: { value: 'Bimpe Adeyemi' },
    });
    fireEvent.click(within(column()).getByRole('button', { name: 'Add guest' }));

    expect(screen.getByText('Bimpe Adeyemi added.')).toBeDefined();
  });
});
