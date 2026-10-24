import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OwnerClaimBanner } from './OwnerClaimBanner.tsx';

const LAPSES = { at: '2026-10-31T09:00:00+00:00', written: 'Saturday 31 Oct at 10:00 WAT' };
const PASSES = { at: '2026-10-27T09:00:00+00:00', written: 'Tuesday 27 Oct at 10:00 WAT' };

// Every key OwnerClaimDescriber::forMembers writes; OwnerClaimTest asserts the same list.
function banner(overrides: Record<string, unknown> = {}) {
  return {
    state: 'no_owner',
    domain: 'ire.events',
    claim: null,
    stopped: null,
    lapsed: null,
    ...overrides,
  };
}

function claim(mine: boolean, found = false) {
  return {
    id: 'claim_1',
    claimant: { id: 'u_bisi', name: 'Bisi', email: 'bisi@ire.events' },
    mine,
    domain: 'ire.events',
    record: mine
      ? { type: 'TXT', name: '_soirely-verify.ire.events', value: 'soirely-claim=abc123' }
      : null,
    startedAt: LAPSES,
    lapsesAt: LAPSES,
    foundAt: found ? PASSES : null,
    passesAt: found ? PASSES : null,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status = 409): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: 'Refused.', status }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function answering(answers: Record<string, () => Response>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ line, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

const PATH = '/api/orgs/org_1/owner-claim';

function open() {
  return render(<OwnerClaimBanner organisationId="org_1" organisation="Ìrè Events" />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the Members banner while no owner is active (sc-6640)', () => {
  it('shows nothing to somebody it is not for', async () => {
    answering({ [`GET ${PATH}`]: () => json({ ownerClaim: null }) });
    const { container } = open();

    await waitFor(() => expect(container.querySelector('.owner-claim')).toBeNull());
  });

  it('starts the claim in one press, with no domain to pick, then shows the record', async () => {
    const sent = answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner() }),
      [`POST ${PATH}`]: () =>
        json({ ownerClaim: banner({ state: 'open', claim: claim(true) }) }, 201),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Become the owner' }));

    expect(
      await screen.findByRole('heading', { name: 'Prove you control ire.events' }),
    ).toBeTruthy();
    expect(screen.getByText('_soirely-verify.ire.events')).toBeTruthy();
    expect(screen.getByText('soirely-claim=abc123')).toBeTruthy();
    expect(
      screen.getByText('We check every hour until Saturday 31 Oct at 10:00 WAT.'),
    ).toBeTruthy();
    expect(sent.find((one) => one.line === `POST ${PATH}`)?.body).toEqual({});
  });

  it('says why when the claimant’s address is not at the domain', async () => {
    answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner() }),
      [`POST ${PATH}`]: () => problem('owner_claim_address'),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Become the owner' }));

    expect(
      await screen.findByText('To become the owner, your main address must be at ire.events.'),
    ).toBeTruthy();
  });

  it('gives the server’s refusal when the organisation lists no domain to name', async () => {
    answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner({ domain: null }) }),
      [`POST ${PATH}`]: () => problem('owner_claim_address'),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Become the owner' }));

    expect(await screen.findByText('Refused.')).toBeTruthy();
    expect(screen.queryByText("That didn't work. Please try again.")).toBeNull();
  });

  it('says the record is not found yet after Check record', async () => {
    answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner({ state: 'open', claim: claim(true) }) }),
      [`POST ${PATH}/check`]: () =>
        json({ ownerClaim: banner({ state: 'open', claim: claim(true) }), found: false }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Check record' }));

    expect(
      await screen.findByText(
        "We couldn't find the record yet. DNS changes can take up to 48 hours.",
      ),
    ).toBeTruthy();
  });

  it('lets another Administrator stop the claim, after confirming, and then the way is closed', async () => {
    const sent = answering({
      [`GET ${PATH}`]: () =>
        json({ ownerClaim: banner({ state: 'found', claim: claim(false, true) }) }),
      [`POST ${PATH}/stop`]: () =>
        json({
          ownerClaim: banner({
            state: 'closed',
            stopped: { by: 'Kemi', claimant: 'Bisi', mine: true, at: PASSES },
          }),
        }),
    });
    open();

    expect(
      await screen.findByRole('heading', {
        name: 'Bisi is becoming the owner. Ownership passes on Tuesday 27 Oct at 10:00 WAT.',
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop this claim' }));
    expect(sent.some((one) => one.line === `POST ${PATH}/stop`)).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Stop the claim' }));

    expect(
      await screen.findByRole('heading', {
        name: 'Ownership has to be restored by Soirely support.',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("You stopped Bisi's claim. Everybody who was told is emailed."),
    ).toBeTruthy();
  });

  it('says so when the claim ended before the stop arrived', async () => {
    answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner({ state: 'open', claim: claim(false) }) }),
      [`POST ${PATH}/stop`]: () => problem('owner_claim_ended'),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Stop this claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Stop the claim' }));

    expect(
      await screen.findByText('This claim has already ended, so there was nothing to stop.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load Members again' })).toBeTruthy();
  });
});

describe('the claimant withdraws their own claim (sc-8204)', () => {
  it('offers Withdraw my claim only to the claimant, before and after the record is found', async () => {
    for (const [mine, found, offered] of [
      [true, false, true],
      [true, true, true],
      [false, false, false],
      [false, true, false],
    ] as const) {
      answering({
        [`GET ${PATH}`]: () =>
          json({
            ownerClaim: banner({ state: found ? 'found' : 'open', claim: claim(mine, found) }),
          }),
      });
      const { unmount } = open();

      await screen.findByRole('heading');
      expect(screen.queryByRole('button', { name: 'Withdraw my claim' }) != null).toBe(offered);
      unmount();
      vi.restoreAllMocks();
    }
  });

  it('asks first, and Keep my claim or Escape leaves the claim as it was', async () => {
    const sent = answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner({ state: 'open', claim: claim(true) }) }),
    });
    open();

    const withdraw = await screen.findByRole('button', { name: 'Withdraw my claim' });
    fireEvent.click(withdraw);
    const dialog = screen.getByRole('dialog', { name: 'Withdraw your claim?' });
    expect(
      screen.getByText(
        "You won't become the owner of Ìrè Events. Any Administrator, you included, can start a new claim.",
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep my claim' }));

    fireEvent.click(screen.getByRole('button', { name: 'Keep my claim' }));
    expect(dialog.isConnected).toBe(false);
    expect(document.activeElement).toBe(withdraw);

    fireEvent.click(withdraw);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent.some((one) => one.line === `POST ${PATH}/withdraw`)).toBe(false);
    expect(screen.getByText('soirely-claim=abc123')).toBeTruthy();
  });

  it('after a withdrawal before the record is found, says so and offers Become the owner again', async () => {
    answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner({ state: 'open', claim: claim(true) }) }),
      [`POST ${PATH}/withdraw`]: () => json({ ownerClaim: banner(), withdrawn: { told: false } }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw my claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));

    const line = await screen.findByText('You withdrew your claim.');
    expect(line.closest('[role="status"]')).toBe(document.activeElement);
    expect(screen.queryByText(/Everybody who was told is emailed/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Ìrè Events has no active owner' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Become the owner' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('after a withdrawal once the record was found, says everybody told is emailed', async () => {
    answering({
      [`GET ${PATH}`]: () =>
        json({ ownerClaim: banner({ state: 'found', claim: claim(true, true) }) }),
      [`POST ${PATH}/withdraw`]: () => json({ ownerClaim: banner(), withdrawn: { told: true } }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw my claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));

    const line = await screen.findByText(
      'You withdrew your claim. Everybody who was told is emailed.',
    );
    expect(line.closest('[role="status"]')).toBe(document.activeElement);
  });

  it('drops the withdrawn line once the claimant starts a new claim', async () => {
    answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner({ state: 'open', claim: claim(true) }) }),
      [`POST ${PATH}/withdraw`]: () => json({ ownerClaim: banner(), withdrawn: { told: false } }),
      [`POST ${PATH}`]: () =>
        json({ ownerClaim: banner({ state: 'open', claim: claim(true) }) }, 201),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw my claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Become the owner' }));

    expect(
      await screen.findByRole('heading', { name: 'Prove you control ire.events' }),
    ).toBeTruthy();
    expect(screen.queryByText('You withdrew your claim.')).toBeNull();
  });

  it('sends focus back to Withdraw my claim when the withdrawal fails', async () => {
    answering({
      [`GET ${PATH}`]: () => json({ ownerClaim: banner({ state: 'open', claim: claim(true) }) }),
      [`POST ${PATH}/withdraw`]: () => problem('internal', 500),
    });
    open();

    const withdraw = await screen.findByRole('button', { name: 'Withdraw my claim' });
    fireEvent.click(withdraw);
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(withdraw);
  });

  it('says so when the claim ended before the withdrawal arrived, and offers a reload', async () => {
    answering({
      [`GET ${PATH}`]: () =>
        json({ ownerClaim: banner({ state: 'found', claim: claim(true, true) }) }),
      [`POST ${PATH}/withdraw`]: () => problem('owner_claim_ended'),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw my claim' }));
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(await screen.findByText('This claim has already ended.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Load Members again' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Withdraw my claim' })).toBeNull();
  });
});
