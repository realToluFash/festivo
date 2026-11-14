import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetNames } from './savedName.ts';

const tested = config();
const WAIT = { timeout: 10000 };

async function account() {
  const router = createMemoryRouter(routes, { initialEntries: ['/demo/settings/account'] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Your account' }, WAIT);
}

function list(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Settings' });
}

function tile(): string | null {
  return (
    within(list()).getByRole('link', { name: 'Account' }).querySelector('.is-account')
      ?.textContent ?? null
  );
}

function about(): HTMLElement {
  return screen
    .getByRole('heading', { level: 2, name: 'About you' })
    .closest('section') as HTMLElement;
}

async function rename(to: string) {
  fireEvent.click(within(about()).getByRole('button', { name: /Folake Adeyemi/ }));
  fireEvent.change(within(screen.getByRole('dialog')).getByLabelText('Full name'), {
    target: { value: to },
  });
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
  await screen.findByText(`Name changed to ${to}.`, undefined, WAIT);
}

describe('a name saved on Your account at a desk (sc-34213)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => forgetNames());

  it('reaches the list’s tile and the sidebar’s foot with the page’s card', async () => {
    await account();
    expect(tile()).toBe('FA');
    expect(screen.getByRole('button', { name: 'Folake Adeyemi, Owner' })).toBeDefined();

    await rename('Oluwafolakemi Bello');

    expect(tile()).toBe('OB');
    expect(screen.getByRole('button', { name: 'Oluwafolakemi Bello, Owner' })).toBeDefined();
    expect(within(about()).getByRole('button', { name: /Oluwafolakemi Bello/ })).toBeDefined();
  });

  it('takes one initial from a one-word name', async () => {
    await account();
    await rename('Cher');

    expect(tile()).toBe('C');
    expect(screen.getByRole('button', { name: 'Cher, Owner' })).toBeDefined();
  });

  it('lasts for the visit, across another section and back', async () => {
    await account();
    await rename('Cher');

    fireEvent.click(within(list()).getByRole('link', { name: 'Members' }));
    await screen.findByRole('heading', { level: 1, name: 'Members' }, WAIT);
    expect(tile()).toBe('C');
    expect(screen.getByRole('button', { name: 'Cher, Owner' })).toBeDefined();
    expect(screen.getAllByText('Folake Adeyemi').length).toBeGreaterThan(0);

    fireEvent.click(within(list()).getByRole('link', { name: 'Account' }));
    await screen.findByRole('heading', { level: 1, name: 'Your account' }, WAIT);
    expect(within(about()).getByRole('button', { name: /Cher/ })).toBeDefined();
    expect(tile()).toBe('C');
  });

  it('changes nothing on Cancel', async () => {
    await account();
    fireEvent.click(within(about()).getByRole('button', { name: /Folake Adeyemi/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(tile()).toBe('FA');
    expect(screen.getByRole('button', { name: 'Folake Adeyemi, Owner' })).toBeDefined();
  });
});
