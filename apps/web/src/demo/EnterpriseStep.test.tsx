import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetAsks } from './enterpriseAsk.ts';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const AT = '/demo/settings/data-and-control';
const CONTACT = 'Contact Soirely about Enterprise';
const ASK = 'Ask an owner';

async function open(path: string, title: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}${path}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title }, FIRST_LOAD);

  return router;
}

describe('the step on a locked Enterprise card (sc-72241)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    forgetAsks();
  });

  it.each([
    ['', 'Data and control'],
    ['/email-domains', 'Email domains'],
    ['/audit-log', 'Audit log'],
    ['/delete-guest-data', 'Delete guest data after an event'],
  ])('gives an owner Contact on %s, and an admin Ask an owner', async (path, title) => {
    await open(`${path}?state=owner_web`, title);
    expect(screen.getByRole('button', { name: CONTACT })).toBeDefined();
    expect(screen.queryByRole('button', { name: ASK })).toBeNull();

    cleanup();
    await open(`${path}?state=admin&as=julien`, title);
    expect(screen.getByRole('button', { name: ASK })).toBeDefined();
    expect(screen.queryByRole('button', { name: CONTACT })).toBeNull();
  });

  it('opens Compare plans with Enterprise in view, and Close puts the focus back on Contact', async () => {
    await open('/email-domains?state=owner_web', 'Email domains');
    const contact = screen.getByRole('button', { name: CONTACT });

    fireEvent.click(contact);
    const dialog = await screen.findByRole('dialog', { name: 'Compare plans' });
    expect(within(dialog).getByRole('heading', { level: 3, name: 'Enterprise' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Talk to us' })).toBeDefined();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Compare plans' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(contact));
  });

  it('sends once, then says the owner was asked when another page asks again', async () => {
    await open('/audit-log?state=admin&as=julien', 'Audit log');
    const ask = screen.getByRole('button', { name: ASK });

    fireEvent.click(ask);
    expect(ask.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(ask);
    await waitFor(() => expect(screen.queryByRole('button', { name: ASK })).toBeNull());

    expect(screen.queryByRole('button', { name: ASK })).toBeNull();
    expect(
      within(screen.getByRole('status')).getByText(
        'The owner has been sent the link to Compare plans.',
      ),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(screen.getByRole('status')).getByText(
          'The owner has been sent the link to Compare plans.',
        ),
      ),
    );

    cleanup();
    await open('/email-domains?state=admin&as=julien', 'Email domains');
    fireEvent.click(screen.getByRole('button', { name: ASK }));
    await waitFor(() => expect(screen.queryByRole('button', { name: ASK })).toBeNull());

    expect(screen.queryByRole('button', { name: ASK })).toBeNull();
    expect(
      within(screen.getByRole('alert')).getByText(
        'The owner was asked about Enterprise in the last 24 hours.',
      ),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(screen.getByRole('alert')).getByText(
          'The owner was asked about Enterprise in the last 24 hours.',
        ),
      ),
    );
  });

  it('keeps the button after Not sent, with the line under it', async () => {
    await open(
      '/delete-guest-data?state=admin_not_sent&as=julien',
      'Delete guest data after an event',
    );

    expect(screen.getByRole('button', { name: ASK })).toBeDefined();
    expect(
      within(screen.getByRole('alert')).getByText('Not sent. Try again in a moment.'),
    ).toBeDefined();
  });

  it.each([
    ['admin_sent_several', 'The owners have been sent the link to Compare plans.'],
    ['admin_asked_several', 'The owners were asked about Enterprise in the last 24 hours.'],
    ['admin_asked_one', 'The owner was asked about Enterprise in the last 24 hours.'],
  ])('opens %s with its words in place of the button', async (state, words) => {
    await open(`?state=${state}&as=julien`, 'Data and control');

    expect(screen.getByText(words)).toBeDefined();
    expect(screen.queryByRole('button', { name: ASK })).toBeNull();
  });

  it('holds the button busy while sending', async () => {
    await open('/email-domains?state=admin_sending&as=julien', 'Email domains');

    expect(screen.getByRole('button', { name: ASK }).getAttribute('aria-busy')).toBe('true');
  });

  it('shows no step once the organisation has left Enterprise', async () => {
    await open('/delete-guest-data?state=rt_downgraded', 'Delete guest data after an event');

    expect(screen.queryByRole('button', { name: CONTACT })).toBeNull();
    expect(screen.queryByRole('button', { name: ASK })).toBeNull();
  });
});
