import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const OLD = '/api/calendar-feeds/Qe4tRw8YuP2aKd7Lx3Vb9Nm1Hz6Jc5GsTq0Wn2Ef4Ab.ics';
const NEW = '/api/calendar-feeds/Zz4tRw8YuP2aKd7Lx3Vb9Nm1Hz6Jc5GsTq0Wn2Ef4Ab.ics';

function signedIn(): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations: [IRE],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function answering({ reset = 'ok' }: { reset?: 'ok' | 'fail' } = {}) {
  const sent: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';

    sent.push(`${method} ${url.pathname}`);

    if (url.pathname === '/api/orgs/org_1/calendar-feed') {
      return new Response(JSON.stringify({ path: OLD }), { status: 200 });
    }

    if (url.pathname === '/api/orgs/org_1/calendar-feed/reset') {
      return reset === 'ok'
        ? new Response(JSON.stringify({ path: NEW }), { status: 200 })
        : new Response('{}', { status: 500 });
    }

    return new Response(JSON.stringify({ events: [], total: 0 }), { status: 200 });
  });

  return sent;
}

async function openPanel(): Promise<HTMLElement> {
  render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/calendar'] })} />,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Subscribe/ }));

  return screen.getByRole('dialog', { name: 'Subscribe in your calendar app' });
}

function linkField(panel: HTMLElement): HTMLInputElement {
  return within(panel).getByRole('textbox', { name: 'Your private link' }) as HTMLInputElement;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Subscribe in your calendar app (sc-3626)', () => {
  it('shows the private link, as https to copy and as webcal to open', async () => {
    signedIn();
    answering();
    const panel = await openPanel();

    expect(within(panel).getByText(/Events and milestones from Ìrè Events show/)).toBeTruthy();
    expect(await within(panel).findByDisplayValue(`http://api.test${OLD}`)).toBeTruthy();
    expect(
      within(panel).getByRole('link', { name: 'Open in calendar app' }).getAttribute('href'),
    ).toBe(`webcal://api.test${OLD}`);
    expect(within(panel).getByText('Guest names')).toBeTruthy();
    expect(within(panel).getByText('Amounts of money')).toBeTruthy();
  });

  it('copies the link and says so', async () => {
    signedIn();
    answering();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const panel = await openPanel();
    await within(panel).findByDisplayValue(`http://api.test${OLD}`);

    fireEvent.click(within(panel).getByRole('button', { name: 'Copy link' }));

    expect(await within(panel).findByRole('button', { name: 'Copied' })).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(`http://api.test${OLD}`);
    expect(within(panel).getByRole('status').textContent).toBe('Link copied.');
  });

  it('selects the link for a keyboard copy when the browser refuses', async () => {
    signedIn();
    answering();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) } });
    const panel = await openPanel();
    await within(panel).findByDisplayValue(`http://api.test${OLD}`);

    fireEvent.click(within(panel).getByRole('button', { name: 'Copy link' }));

    expect((await within(panel).findByRole('alert')).textContent).toMatch(/press Ctrl\+C/);
    expect(document.activeElement).toBe(linkField(panel));
  });

  it('resets the link only once confirmed, and shows the new one', async () => {
    signedIn();
    const sent = answering();
    const panel = await openPanel();
    await within(panel).findByDisplayValue(`http://api.test${OLD}`);

    fireEvent.click(within(panel).getByRole('button', { name: 'Reset link' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Reset your link?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Reset link' }));

    expect(await within(panel).findByDisplayValue(`http://api.test${NEW}`)).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(panel).getByText(/New link made\. The old one has stopped working/)).toBeTruthy();
    expect(sent.filter((line) => line.startsWith('POST'))).toEqual([
      'POST /api/orgs/org_1/calendar-feed/reset',
    ]);
    expect(document.activeElement).toBe(linkField(panel));
  });

  it('keeps the link when the reset is kept, and when it fails', async () => {
    signedIn();
    const sent = answering({ reset: 'fail' });
    const panel = await openPanel();
    await within(panel).findByDisplayValue(`http://api.test${OLD}`);

    fireEvent.click(within(panel).getByRole('button', { name: 'Reset link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep this link' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(panel).getByRole('status').textContent).toBe('Link unchanged.');
    expect(sent.some((line) => line.startsWith('POST'))).toBe(false);

    fireEvent.click(within(panel).getByRole('button', { name: 'Reset link' }));
    const confirm = screen.getByRole('alertdialog', { name: 'Reset your link?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Reset link' }));

    expect((await within(confirm).findByRole('alert')).textContent).toMatch(
      /Not reset\. Your link is unchanged\. Try again\.$/,
    );
    expect(linkField(panel).value).toBe(`http://api.test${OLD}`);
  });

  it('closes, and Escape closes it too', async () => {
    signedIn();
    answering();
    const panel = await openPanel();

    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Subscribe in your calendar app' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Subscribe/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Subscribe in your calendar app' })).toBeNull();
  });
});
