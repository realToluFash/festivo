import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { tiedEnd } from '../components/SettingsParts.tsx';

const tested = config();
const OFF = 'They’re emailed now, and every session they had has ended.';
const DOWN = 'Two-factor stays on for them, and they’re emailed.';
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

async function onCard(says: string, line: string): Promise<void> {
  await waitFor(() => {
    const words = document.activeElement;
    expect(words?.classList.contains('desk-said-lines')).toBe(true);
    expect([...(words?.children ?? [])].map((one) => one.textContent)).toEqual([says, line]);
  });
}

function atDesk(): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query === '(width >= 96rem)',
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as never,
  );
}

function verb(name: string): HTMLElement {
  return within(screen.getByRole('alertdialog')).getByRole('button', { name });
}

function headings(): string[] {
  return screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent ?? '');
}

describe('Requests to get back in on Members at a desk (sc-30183)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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

  it('sends the answer once, keeping the focus, while Cancel and Escape wait', async () => {
    await members('/demo/settings/members?state=recoveryApprove');

    const send = verb('Turn off two-factor');
    send.focus();
    fireEvent.click(send);

    expect(send.textContent).toBe('Sending your answer…');
    expect(send.getAttribute('aria-busy')).toBe('true');
    expect(send.getAttribute('aria-disabled')).toBe('true');
    expect(send.hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(send);
    expect(verb('Cancel').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(send);
    fireEvent.click(verb('Cancel'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeDefined();

    await onCard('Kofi Mensah’s two-factor is off.', OFF);
  });

  it('turns off two-factor, says so on the card with the focus, and offers Priya’s', async () => {
    await members('/demo/settings/members?state=recoveryApprove');

    fireEvent.click(screen.getByRole('button', { name: 'Turn off two-factor' }));
    await onCard('Kofi Mensah’s two-factor is off.', OFF);

    expect(screen.queryByRole('article', { name: 'Kofi Mensah' })).toBeNull();
    expect(
      screen.getByText('They’re emailed now, and every session they had has ended.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Answer Priya Shah' })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Kofi Mensah/u }).textContent).toContain('Member');
  });

  it('holds the answer on its way for the link, then lands it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await members('/demo/settings/members?state=recoverySending');

    const send = verb('Sending your answer…');
    await waitFor(() => expect(document.activeElement).toBe(send));
    expect(send.getAttribute('aria-busy')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeDefined();
    await act(() => vi.advanceTimersByTimeAsync(8000));

    expect(screen.getByText('Kofi Mensah’s two-factor is off.')).toBeDefined();
  });

  it('says a failed answer as an alert, with the focus on the verb to try again', async () => {
    await members('/demo/settings/members?state=recoveryFailed');

    const ask = screen.getByRole('alertdialog', {
      name: 'Approve, and turn off Kofi Mensah’s two-factor?',
    });
    expect(within(ask).getByRole('alert').textContent).toBe(
      'That did not work. Try again in a moment.',
    );
    const again = verb('Turn off two-factor');
    await waitFor(() => expect(document.activeElement).toBe(again));
    fireEvent.click(again);

    expect(within(ask).queryByRole('alert')).toBeNull();
    expect(again.textContent).toBe('Sending your answer…');
    await onCard('Kofi Mensah’s two-factor is off.', OFF);
  });

  it('closes a failed answer with nothing changed, the focus back on Approve', async () => {
    await members('/demo/settings/members?state=recoveryFailed');

    fireEvent.click(verb('Cancel'));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('7 people · 3 waiting')).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(request('Kofi Mensah')).getByRole('button', { name: 'Approve' }),
      ),
    );
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
    expect(verb('Sending your answer…').getAttribute('aria-busy')).toBe('true');
    expect(verb('Keep the request').getAttribute('aria-disabled')).toBe('true');
    await onCard('Kofi Mensah’s request is turned down.', DOWN);

    expect(screen.getByText('Two-factor stays on for them, and they’re emailed.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Answer Priya Shah' })).toBeDefined();
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

  it('closes the last request, answered elsewhere, onto the card’s words (sc-33322)', async () => {
    await members('/demo/settings/members?state=recoveryClosedLast');

    expect(screen.getByText('Priya Shah’s two-factor is off.')).toBeDefined();
    const ask = screen.getByRole('alertdialog', {
      name: 'Approve, and turn off Kofi Mensah’s two-factor?',
    });
    expect(within(ask).getByRole('alert').textContent).toBe(
      'This request has already been answered, or it has ended.',
    );
    await landed('Close');
    fireEvent.click(within(ask).getByRole('button', { name: 'Close' }));

    await onCard('Priya Shah’s two-factor is off.', OFF);
    expect(screen.queryByRole('article', { name: 'Kofi Mensah' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Requests to get back in' })).toBeNull();
  });

  it('leaves nothing about requests to get back in once none waits', async () => {
    await members('/demo/settings/members?state=recovery');

    for (const name of ['Kofi Mensah', 'Priya Shah']) {
      fireEvent.click(within(request(name)).getByRole('button', { name: 'Approve' }));
      fireEvent.click(screen.getByRole('button', { name: 'Turn off two-factor' }));
      await onCard(`${name}’s two-factor is off.`, OFF);
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
    await onCard('Priya Shah’s two-factor is off.', OFF);
  });

  it('opens recoveryApproved and recoveryTurnedDown with the focus on the card’s words (sc-33322)', async () => {
    await members('/demo/settings/members?state=recoveryApproved');
    await onCard('Kofi Mensah’s two-factor is off.', OFF);
    cleanup();

    await members('/demo/settings/members?state=recoveryTurnedDown');
    await onCard('Kofi Mensah’s request is turned down.', DOWN);
  });

  it('lands both answers on the card’s words from 1536 wide, beside an open person (sc-33322)', async () => {
    atDesk();
    await members('/demo/settings/members?state=recovery');

    fireEvent.click(screen.getByRole('button', { name: /^Ana Souza/u }));
    fireEvent.click(within(request('Kofi Mensah')).getByRole('button', { name: 'Approve' }));
    fireEvent.click(verb('Turn off two-factor'));
    await onCard('Kofi Mensah’s two-factor is off.', OFF);

    fireEvent.click(within(request('Priya Shah')).getByRole('button', { name: 'Turn down' }));
    fireEvent.click(verb('Turn down the request'));
    await onCard('Priya Shah’s request is turned down.', DOWN);
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

  it('ends Priya’s request when she is removed, and the step stays on Kofi’s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await members('/demo/settings/members?state=recovery');

    fireEvent.click(screen.getByRole('button', { name: /^Priya Shah/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Ire Events…' }));
    fireEvent.click(verb('Remove'));
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(screen.getByText('Priya Shah was removed')).toBeDefined();
    expect(screen.getAllByRole('article')).toEqual([request('Kofi Mensah')]);
    expect(screen.getByRole('button', { name: 'Answer Kofi Mensah' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'See Former' })).toBeNull();
  });

  it('ends Kofi’s request when he is removed, and the step moves on to Priya’s', async () => {
    await members('/demo/settings/members?state=recovery');

    fireEvent.click(screen.getByRole('button', { name: /^Kofi Mensah/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Ire Events…' }));
    fireEvent.click(verb('Remove'));

    expect(screen.getByText('Kofi Mensah was removed')).toBeDefined();
    expect(screen.queryByRole('article', { name: 'Kofi Mensah' })).toBeNull();
    expect(screen.getAllByRole('article')).toEqual([request('Priya Shah')]);
    expect(
      screen.getByText(
        'Their events stay with Ire Events. They are listed under Former, with everything they did kept.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Answer Priya Shah' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'See Former' })).toBeNull();
  });

  it('ends both requests when Kofi and Priya are removed, and the step moves on to Lucía', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await members('/demo/settings/members?state=recovery');

    fireEvent.click(screen.getByRole('button', { name: /^Kofi Mensah/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Ire Events…' }));
    fireEvent.click(verb('Remove'));
    fireEvent.click(screen.getByRole('button', { name: /^Priya Shah/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from Ire Events…' }));
    fireEvent.click(verb('Remove'));
    await act(() => vi.advanceTimersByTimeAsync(600));

    expect(screen.getByText('Priya Shah was removed')).toBeDefined();
    expect(screen.queryAllByRole('article')).toEqual([]);
    expect(screen.queryByRole('heading', { name: 'Requests to get back in' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Answer Lucía Gómez' })).toBeDefined();
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

describe('Remove from a long-named organisation, wrapped whole (sc-40153)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => cleanup());

  it.each([
    ['longName', 'Ẹgbẹ́ Ọ̀rẹ́ Àṣà Ìbílẹ̀ Ọ̀ṣun Òṣogbo àti Ilé-Ifẹ̀, Ọ̀yọ́, Abẹ́òkúta, Ìjẹ̀bú-Òde àti Ẹ̀kìtì'],
    [
      'oneWordName',
      'TheGrandBallroomWeddingsGalasAndGardenPartiesCompanyOfLagosLisbonMadridMonterreyAndPortoAlegreEvents',
    ],
  ])(
    'names the whole of %s’s organisation, in its words and its name, and opens the confirm',
    async (state, name) => {
      await members(`/demo/settings/members?state=${state}`);

      const remove = screen.getByRole('button', { name: `Remove from ${name}…` });
      expect(remove.classList.contains('is-wraps')).toBe(true);
      expect(
        screen.getByText(`They lose access on their next request. Their events stay with ${name}.`),
      ).toBeDefined();

      fireEvent.click(remove);
      expect(screen.getByRole('alertdialog').textContent).toContain(`from ${name}?`);
      expect(remove.querySelector('.desk-tied')?.textContent?.endsWith('…')).toBe(true);
    },
  );

  it.each(['longName', 'oneWordName'])(
    'names the same organisation in %s’s Suspend confirm',
    async (state) => {
      await members(`/demo/settings/members?state=${state}`);
      const name = screen
        .getByRole('button', { name: /^Remove from .+…$/u })
        .textContent?.replace(/^Remove from |…$/gu, '');

      fireEvent.click(screen.getByRole('button', { name: 'Suspend…' }));
      expect(screen.getByRole('alertdialog').textContent).toContain(`can’t use ${name} from`);
    },
  );

  it('ties the "…" to the name’s last letters, marks and all', () => {
    expect(tiedEnd('Remove from Ẹ̀kìtì…')).toEqual(['Remove from Ẹ̀kì', 'tì…']);
    expect(tiedEnd('Remove from Ire Events…')).toEqual(['Remove from Ire Even', 'ts…']);
    expect(tiedEnd('Remove from Ìrè Events…')).toEqual(['Remove from Ìrè Even', 'ts…']);
  });

  it('holds the column to a 320 page’s in the At320 states', async () => {
    await members('/demo/settings/members?state=longNameAt320');

    expect(screen.getByText('Demo only: a 320 page’s column, 288 wide')).toBeDefined();
  });

  it('keeps Ire Events as today', async () => {
    await members('/demo/settings/members?state=priya');

    expect(screen.getByRole('button', { name: 'Remove from Ire Events…' })).toBeDefined();
  });
});

describe('An invitation whose email never arrived (sc-46109)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => cleanup());

  function row(email: string): HTMLElement {
    const name = screen.getAllByText(email).find((one) => one.closest('li') != null);
    const line = name?.closest('li');
    if (line == null) throw new Error(`no row for ${email}`);

    return line;
  }

  it('says Not delivered with the broken mark where Sent was, beside one that arrived', async () => {
    await members('/demo/settings/members?state=notDelivered');

    expect(row('nnamdi.eze@ire.events').textContent).toContain(
      'Sent Nov 2, 2026 · expires Nov 9, 2026',
    );
    expect(row('nnamdi.eze@ire.events').querySelector('.mark-broken')).toBeNull();

    const ada = row('ada.obi@ire.events');
    expect(ada.textContent).toContain('Not delivered · expires Nov 11, 2026');
    expect(ada.querySelector('.mark-broken')?.getAttribute('aria-hidden')).toBe('true');
    expect(within(ada).getByRole('button', { name: 'Revoke' })).toBeDefined();

    for (const [email, dates] of [
      [
        'ines.duarte@gmail.com',
        'ExpiredMember · invited by you✕Not delivered · expired Oct 21, 2026',
      ],
      ['lena.vogel@web.de', 'RevokedAdmin · invited by you✕Not delivered · revoked Nov 3, 2026'],
      [
        'yusuf.bello@outlook.com',
        'DeclinedMember · invited by Julien Moreau✕Not delivered · declined Oct 3, 2026',
      ],
    ] as const) {
      expect(row(email).textContent).toContain(dates);
      expect(within(row(email)).getByRole('button', { name: 'Invite again' })).toBeDefined();
    }
  });

  it('lists the same rows on the Invited filter, counting the pending ones', async () => {
    await members('/demo/settings/members?state=notDeliveredInvited');

    expect(row('ada.obi@ire.events').textContent).toContain('Not delivered · expires Nov 11, 2026');
    expect(screen.getByRole('button', { name: /Invited · 2/u })).toBeDefined();
  });

  it('reads Not delivered again after Invite again to an address still held back', async () => {
    await members('/demo/settings/members?state=notDelivered');

    fireEvent.click(
      within(row('ines.duarte@gmail.com')).getByRole('button', { name: 'Invite again' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Send invitation' }),
    );

    await waitFor(() =>
      expect(
        screen.getAllByText('Invitation sent to ines.duarte@gmail.com').length,
      ).toBeGreaterThan(0),
    );
    expect(row('ines.duarte@gmail.com').textContent).toContain(
      'Not delivered · expires Nov 11, 2026',
    );
  });

  it('opens notDeliveredAgain with the notice unchanged and the row not delivered', async () => {
    await members('/demo/settings/members?state=notDeliveredAgain');

    expect(screen.getAllByText('Invitation sent to ines.duarte@gmail.com').length).toBeGreaterThan(
      0,
    );
    expect(row('ines.duarte@gmail.com').textContent).toContain(
      'Not delivered · expires Nov 11, 2026',
    );
  });
});
