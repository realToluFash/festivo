import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const INTRO =
  'They lost their authenticator and their recovery codes, and stay signed out until somebody answers. One answer from an owner or admin is enough. Approve only if you’re sure it’s them, for example by calling them on a number you already have.';

async function members(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
  await screen.findByRole('navigation', { name: 'Settings' });
}

function request(name: string): HTMLElement {
  return screen.getByRole('article', { name });
}

async function landed(text: string): Promise<void> {
  await waitFor(() => expect(document.activeElement?.textContent).toBe(text));
}

function headings(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent ?? '');
}

describe('Requests to get back in on Members at a desk (sc-30183)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('lists them under the card, above Waiting, each read with the paragraph said once', async () => {
    await members('/demo/settings/members?state=recovery');

    expect(screen.getByText('7 people · 3 waiting')).toBeDefined();
    expect(screen.getByText('2 to get back in · 1 to join')).toBeDefined();
    expect(headings().slice(-4)).toEqual([
      'Requests to get back in',
      'Waiting',
      'People',
      'Invitations',
    ]);
    expect(screen.getAllByText(INTRO)).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Kofi Mensah', description: INTRO })).toBeDefined();
    expect(screen.getByRole('article', { name: 'Priya Shah', description: INTRO })).toBeDefined();

    const kofi = within(request('Kofi Mensah'));
    expect(kofi.getByText('Waiting for an answer')).toBeDefined();
    expect(kofi.getByText('kofi@ire.events')).toBeDefined();
    expect(
      kofi.getByText('Asked to turn off two-factor · Proved with codes to their email and phone'),
    ).toBeDefined();
    expect(kofi.getAllByRole('button').map((one) => one.textContent)).toEqual([
      'Approve',
      'Turn down',
    ]);
    expect(
      screen.getByText(
        'Only owners and admins see this. A request leaves it once somebody answers or it ends.',
      ),
    ).toBeDefined();
  });

  it('takes the card’s step, and the focus, to Kofi’s request, and lights it', async () => {
    await members('/demo/settings/members?state=recovery');

    fireEvent.click(screen.getByRole('button', { name: 'Answer Kofi Mensah' }));

    await waitFor(() => expect(document.activeElement).toBe(request('Kofi Mensah')));
    expect(request('Kofi Mensah').classList.contains('is-on')).toBe(true);
    expect(request('Priya Shah').classList.contains('is-on')).toBe(false);
  });

  it('asks once before Approve, and Escape changes nothing and gives the focus back to Approve', async () => {
    await members('/demo/settings/members?state=recovery');

    const approve = within(request('Kofi Mensah')).getByRole('button', { name: 'Approve' });
    approve.focus();
    fireEvent.click(approve);
    const ask = screen.getByRole('alertdialog', {
      name: 'Approve, and turn off Kofi Mensah’s two-factor?',
    });
    expect(
      within(ask).getByText(
        'Every session they have ends. They sign in again with their password, Google or Apple, and are asked to set up two-factor again.',
      ),
    ).toBeDefined();
    expect(
      within(ask)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Cancel', 'Turn off two-factor']);
    await landed('Cancel');
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(request('Kofi Mensah')).getByRole('button', { name: 'Approve' }),
      ),
    );
  });

  it('turns off two-factor, says so on the card with the focus, and offers Priya’s', async () => {
    await members('/demo/settings/members?state=recoveryApprove');

    fireEvent.click(screen.getByRole('button', { name: 'Turn off two-factor' }));

    expect(screen.queryByRole('article', { name: 'Kofi Mensah' })).toBeNull();
    expect(
      screen.getByText('They’re emailed now, and every session they had has ended.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Answer Priya Shah' })).toBeDefined();
    await landed('Kofi Mensah’s two-factor is off.');
    expect(screen.getByRole('button', { name: /^Kofi Mensah/u }).textContent).toContain('Member');
  });

  it('keeps the request from Turn down’s confirm and gives the focus back to Turn down', async () => {
    await members('/demo/settings/members?state=recoveryTurnDown');

    const ask = screen.getByRole('alertdialog', { name: 'Turn down Kofi Mensah’s request?' });
    expect(
      within(ask)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Keep the request', 'Turn down the request']);
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep the request' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(request('Kofi Mensah')).getByRole('button', { name: 'Turn down' }),
      ),
    );
  });

  it('turns the request down and offers Priya’s', async () => {
    await members('/demo/settings/members?state=recoveryTurnDown');

    fireEvent.click(screen.getByRole('button', { name: 'Turn down the request' }));

    expect(screen.getByText('Two-factor stays on for them, and they’re emailed.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Answer Priya Shah' })).toBeDefined();
    await landed('Kofi Mensah’s request is turned down.');
  });

  it('closes a request answered elsewhere with Close alone, and Priya’s takes the focus', async () => {
    await members('/demo/settings/members?state=recoveryClosed');

    const ask = screen.getByRole('alertdialog', {
      name: 'Approve, and turn off Kofi Mensah’s two-factor?',
    });
    expect(within(ask).getByRole('alert').textContent).toBe(
      'This request has already been answered, or it has ended.',
    );
    expect(
      within(ask)
        .getAllByRole('button')
        .map((one) => one.textContent),
    ).toEqual(['Close']);
    await landed('Close');
    fireEvent.click(within(ask).getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('article', { name: 'Kofi Mensah' })).toBeNull();
    expect(screen.getByText('7 people · 2 waiting')).toBeDefined();
    expect(screen.getByText('1 to get back in · 1 to join')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(request('Priya Shah')));
  });

  it('leaves nothing about requests to get back in once none waits', async () => {
    await members('/demo/settings/members?state=recovery');

    for (const name of ['Kofi Mensah', 'Priya Shah']) {
      fireEvent.click(within(request(name)).getByRole('button', { name: 'Approve' }));
      fireEvent.click(screen.getByRole('button', { name: 'Turn off two-factor' }));
      await landed(`${name}’s two-factor is off.`);
    }

    expect(screen.queryByRole('heading', { name: 'Requests to get back in' })).toBeNull();
    expect(screen.queryByText(INTRO)).toBeNull();
    expect(screen.getByRole('button', { name: 'Answer Lucía Gómez' })).toBeDefined();
  });

  it('opens recoveryDone on the empty list', async () => {
    await members('/demo/settings/members?state=recoveryDone');

    expect(screen.queryByRole('heading', { name: 'Requests to get back in' })).toBeNull();
    expect(screen.getByText('Priya Shah’s two-factor is off.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Answer Lucía Gómez' })).toBeDefined();
  });

  it('shows Julien his own request with the line in place of the answers', async () => {
    await members('/demo/settings/members?as=julien&state=recoveryOwn');

    const own = within(request('Julien Moreau (you)'));
    expect(
      own.getByText('This is your own request. Somebody else in Ire Events has to answer it.'),
    ).toBeDefined();
    expect(own.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('7 people · 1 waiting')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Answer Lucía Gómez' })).toBeDefined();
  });

  it('opens Members with no request for anybody else’s recoveryOwn, or with no state', async () => {
    await members('/demo/settings/members?state=recoveryOwn');
    expect(screen.queryByRole('heading', { name: 'Requests to get back in' })).toBeNull();
    expect(screen.getByText('7 people · 1 waiting')).toBeDefined();
  });

  it('shows a member no request and nothing that says one exists', async () => {
    await members('/demo/settings/members?as=ana&state=recovery');

    expect(screen.queryByRole('heading', { level: 1, name: 'Members' })).toBeNull();
    expect(screen.queryByText(/get back in/u)).toBeNull();
  });

  it('keeps Lucía’s request to join answering from Waiting', async () => {
    await members('/demo/settings/members?state=recovery');

    fireEvent.click(screen.getByRole('button', { name: /^Lucía Gómez/u }));
    expect(screen.getByRole('dialog', { name: 'Lucía’s request' })).toBeDefined();
  });

  it('shows no request on General at a desk', async () => {
    render(
      <RouterProvider
        router={createMemoryRouter(routes, {
          initialEntries: ['/demo/settings/general?state=recovery'],
        })}
      />,
    );
    await screen.findByRole('heading', { level: 1, name: 'General' });

    expect(screen.queryByText(/get back in/u)).toBeNull();
  });
});
