import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(query: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/link-card?${query}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'A guest’s link in a chat' });

  return router;
}

const chat = () => within(screen.getByRole('region', { name: 'WhatsApp on the host’s phone' }));
const head = () => document.querySelector('.lk-code')?.textContent ?? '';

describe('/demo/link-card (sc-89272)', () => {
  it('draws the photo, the name and the hosts’ line in the bubble', async () => {
    await open('state=photo');

    expect(chat().getByText('Adaeze & Tunde’s wedding')).toBeTruthy();
    expect(chat().getByText('Your invitation from Adaeze Obi and Tunde Bakare')).toBeTruthy();
    expect(document.querySelector('.lk-photo')).not.toBeNull();
    expect(head()).toContain('og:image:alt');
  });

  it('draws the event’s colour, and the demo’s pick changes it', async () => {
    const router = await open('state=colour');

    fireEvent.click(screen.getByRole('radio', { name: 'party' }));

    expect(router.state.location.search).toContain('mesh=party');
    expect(document.querySelector('.lk-bubble img')?.getAttribute('src')).toContain('party');
  });

  it('draws an ended event’s name alone, with no picture and no line', async () => {
    await open('state=ended');

    expect(chat().getByText('Adaeze & Tunde’s wedding')).toBeTruthy();
    expect(chat().queryByText(/Your invitation from/u)).toBeNull();
    expect(document.querySelector('.lk-picture')).toBeNull();
  });

  it('draws Soirely alone for a link that opens no page', async () => {
    await open('state=gone');

    expect(chat().getByText('Soirely')).toBeTruthy();
    expect(head()).toBe('<title>Soirely</title>');
  });

  it('marks the French card’s words as French', async () => {
    await open('state=french');

    expect(document.querySelector('.lk-preview')?.getAttribute('lang')).toBe('fr');
  });
});
