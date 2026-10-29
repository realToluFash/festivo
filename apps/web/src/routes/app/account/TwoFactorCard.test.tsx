import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __setSessionState } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { TwoFactorCard } from './TwoFactorCard.tsx';

const ENROLMENT = {
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  otpauthUri: 'otpauth://totp/Soirely:folake@ire.events?secret=JBSW&issuer=Soirely',
  qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
};

const CODES = [
  'abcd-efgh',
  'jkmn-pqrs',
  'tuvw-xyz2',
  '3456-789a',
  'bcde-fghj',
  'kmnp-qrst',
  'uvwx-yz23',
  '4567-89ab',
  'cdef-ghjk',
  'mnpq-rstu',
];

function answering(answers: Record<string, () => Response | Promise<Response>>) {
  const sent: { path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(String(input)).pathname;
    sent.push({ path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = answers[`${init?.method ?? 'GET'} ${path}`];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function problem(code: string, status: number): Response {
  return json({ type: `https://soirely.com/errors/${code}`, title: 'No.', status }, status);
}

function card(onBusy = vi.fn()) {
  render(<TwoFactorCard email="folake@ire.events" onBusy={onBusy} recount={0} />);

  return onBusy;
}

// Several round trips each, more than findBy's default second under the full suite's load.
const UNDER_LOAD = { timeout: 3000 };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('turning two-factor on', () => {
  it('stays off until a code from the new key matches, then shows ten codes once', async () => {
    let on = false;
    const sent = answering({
      'GET /api/auth/two-factor': () => json({ on, recoveryCodesLeft: on ? 10 : 0 }),
      'POST /api/auth/two-factor/enrol': () => json(ENROLMENT),
      'POST /api/auth/two-factor/activate': () => {
        const body = sent.at(-1)?.body as { code: string };
        if (body.code !== '123456') return problem('two_factor_code_invalid', 422);
        on = true;
        return json({ recoveryCodes: CODES });
      },
    });
    const onBusy = card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on two-factor' }, UNDER_LOAD));

    const setup = await screen.findByRole(
      'heading',
      { name: 'Turn on two-factor authentication' },
      UNDER_LOAD,
    );
    expect(document.activeElement).toBe(setup);
    expect(screen.getByText('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP')).toBeDefined();
    expect(screen.getByRole('img', { name: 'QR code for your authenticator app' })).toBeDefined();
    await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(true), UNDER_LOAD);

    fireEvent.click(screen.getByRole('button', { name: 'Check the code' }));
    expect(screen.getByText('Enter the 6-digit code from your app.')).toBeDefined();
    expect(sent.filter((r) => r.path.endsWith('/activate'))).toEqual([]);

    fireEvent.change(screen.getByLabelText('Enter the 6-digit code the app shows'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check the code' }));
    await screen.findByText(
      'That code does not match. Check the app was set up with the key above, then enter the code it shows now.',
      undefined,
      UNDER_LOAD,
    );

    fireEvent.change(screen.getByLabelText('Enter the 6-digit code the app shows'), {
      target: { value: '123 456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Check the code' }));

    const save = await screen.findByRole(
      'heading',
      { name: 'Save your recovery codes' },
      UNDER_LOAD,
    );
    expect(document.activeElement).toBe(save);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);

    const finish = screen.getByRole('button', { name: 'Finish' }) as HTMLButtonElement;
    expect(finish.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('I have saved these codes somewhere safe'));
    expect(finish.disabled).toBe(false);
    fireEvent.click(finish);

    await screen.findByText('10 of 10 unused · each works once', undefined, UNDER_LOAD);
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Two-factor authentication' }),
    );
    expect(document.activeElement?.nextElementSibling?.textContent).toBe('✓On');
    await waitFor(() => expect(onBusy).toHaveBeenLastCalledWith(false), UNDER_LOAD);
  });

  it('copies all ten codes, and offers no download', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    const sent = answering({
      'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 3 }),
      'POST /api/auth/two-factor/recovery-codes': () => json({ recoveryCodes: CODES }),
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Make new codes' }, UNDER_LOAD));
    expect(screen.getByText('Your current codes stop working')).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Make new recovery codes?' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Make new codes' }));
    expect(screen.getByText('Enter a code from your app, or a recovery code.')).toBeDefined();
    expect(sent.filter((r) => r.path.endsWith('/recovery-codes'))).toEqual([]);

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make new codes' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Copy all' }, UNDER_LOAD));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Save your recovery codes' }),
    );

    await screen.findByText('All 10 codes are on your clipboard.', undefined, UNDER_LOAD);
    expect(writeText).toHaveBeenCalledWith(CODES.join('\n'));
    expect(sent.find((r) => r.path.endsWith('/recovery-codes'))?.body).toEqual({ code: '123456' });
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
  });

  it('takes focus to the notice when the key cannot be fetched, read once', async () => {
    answering({ 'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }) });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on two-factor' }, UNDER_LOAD));

    const notice = await screen.findByText('Two-factor did not load', undefined, UNDER_LOAD);
    expect(document.activeElement).toBe(notice.parentElement);
    expect(document.activeElement?.textContent).toMatch(/Try again in a moment/);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reads out a card that fails to load, and leaves focus alone', async () => {
    answering({});
    card();

    expect(await screen.findByRole('alert', undefined, UNDER_LOAD)).toBeDefined();
    expect(document.activeElement).toBe(document.body);
  });
});

describe('turning two-factor off', () => {
  it('needs a code, says a wrong one is wrong, and then reads Off', async () => {
    let on = true;
    answering({
      'GET /api/auth/two-factor': () => json({ on, recoveryCodesLeft: 10 }),
      'POST /api/auth/two-factor/disable': () => {
        on = false;
        return new Response(null, { status: 204 });
      },
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD));
    expect(
      screen.getByText('We will email folake@ire.events to say it was turned off.'),
    ).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Turn off two-factor authentication' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }));
    expect(screen.getByText('Enter a code from your app, or a recovery code.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'abcd-efgh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }));

    await waitFor(() => expect(screen.getByText('Off')).toBeDefined(), UNDER_LOAD);
    expect(screen.getByRole('button', { name: 'Turn on two-factor' })).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { name: 'Two-factor authentication' }),
    );
    expect(document.activeElement?.nextElementSibling?.textContent).toBe('Off');
  });

  it('says a wrong code did not work', async () => {
    answering({
      'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 10 }),
      'POST /api/auth/two-factor/disable': () => problem('two_factor_code_invalid', 422),
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }));

    await screen.findByText(
      'That code did not work. Enter the code your app shows now, or an unused recovery code.',
      undefined,
      UNDER_LOAD,
    );
  });
});

describe('while an organisation requires two-factor of everyone (sc-609)', () => {
  function requiredBy(): void {
    const organisation = membership({
      signInRules: {
        providerOnly: false,
        inactivityTimeoutDays: null,
        administratorsNeedTwoFactor: false,
        everyoneNeedsTwoFactor: true,
        changedAt: null,
      },
    });

    __setSessionState({
      status: 'signedIn',
      session: {
        name: 'Folake Adeyemi',
        email: 'folake@ire.events',
        verified: true,
        complete: true,
        awaiting: null,
        providers: [],
        userId: 'u1',
        needsOrganisation: false,
        hasPassword: true,
        organisation,
        organisations: [organisation],
        organisationCountry: null,
        timezone: null,
        waitingFor: null,
      },
    });
  }

  it('refuses turning it off and keeps the card On, asking for no code', async () => {
    requiredBy();
    const sent = answering({
      'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 10 }),
    });
    card();

    const turnOff = await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD);
    turnOff.focus();
    fireEvent.click(turnOff);

    expect(
      screen.getByText('Ìrè Events requires two-factor, so you cannot turn it off.'),
    ).toBeDefined();
    expect(screen.getByText('On')).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Turn off two-factor' }),
    );
    expect(screen.queryByLabelText('Code')).toBeNull();
    expect(sent.filter(({ path }) => path.endsWith('/disable'))).toEqual([]);
  });

  it('says the same when the server refuses it', async () => {
    const sent = answering({
      'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 10 }),
      'POST /api/auth/two-factor/disable': () =>
        json(
          {
            type: 'https://soirely.com/errors/two_factor_kept_by_rule',
            title: 'No.',
            status: 409,
            organisation: 'Ìrè Events',
          },
          409,
        ),
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }));

    expect(
      await screen.findByText(
        'Ìrè Events requires two-factor, so you cannot turn it off.',
        {},
        UNDER_LOAD,
      ),
    ).toBeDefined();
    expect(sent.some(({ path }) => path.endsWith('/disable'))).toBe(true);
    expect(document.activeElement?.textContent).toBe(
      '!Ìrè Events requires two-factor, so you cannot turn it off.',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('closing a step on Two-factor authentication', () => {
  it('goes back to Turn on two-factor after Cancel, once the card has loaded again', async () => {
    answering({
      'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }),
      'POST /api/auth/two-factor/enrol': () => json(ENROLMENT),
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on two-factor' }, UNDER_LOAD));
    await screen.findByRole('heading', { name: 'Turn on two-factor authentication' }, UNDER_LOAD);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const opener = await screen.findByRole('button', { name: 'Turn on two-factor' }, UNDER_LOAD);
    expect(document.activeElement).toBe(opener);
  });

  it('goes back to Turn off two-factor after Keep it on', async () => {
    answering({ 'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 10 }) });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it on' }));

    const opener = await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD);
    expect(document.activeElement).toBe(opener);
  });

  it('goes back to Make new codes after Keep current codes, and after Finish on the new codes', async () => {
    answering({
      'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 3 }),
      'POST /api/auth/two-factor/recovery-codes': () => json({ recoveryCodes: CODES }),
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Make new codes' }, UNDER_LOAD));
    fireEvent.click(screen.getByRole('button', { name: 'Keep current codes' }));

    const opener = await screen.findByRole('button', { name: 'Make new codes' }, UNDER_LOAD);
    expect(document.activeElement).toBe(opener);

    fireEvent.click(opener);
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make new codes' }));
    fireEvent.click(
      await screen.findByLabelText('I have saved these codes somewhere safe', {}, UNDER_LOAD),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    const again = await screen.findByRole('button', { name: 'Make new codes' }, UNDER_LOAD);
    expect(document.activeElement).toBe(again);
  });

  it('takes focus to the notice, read once, when the card cannot load again', async () => {
    let reachable = true;
    answering({
      'GET /api/auth/two-factor': () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return json({ on: true, recoveryCodesLeft: 10 });
      },
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD));
    reachable = false;
    fireEvent.click(screen.getByRole('button', { name: 'Keep it on' }));

    await waitFor(
      () =>
        expect(document.activeElement?.textContent).toBe(
          'Two-factor did not loadSomething went wrong on our side. Try again in a moment.',
        ),
      UNDER_LOAD,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes Try again to the notice when it fails again, and to the heading once it loads', async () => {
    let reachable = false;
    answering({
      'GET /api/auth/two-factor': () => {
        if (!reachable) throw new TypeError('Failed to fetch');
        return json({ on: false, recoveryCodesLeft: 0 });
      },
    });
    card();

    await screen.findByRole('alert', undefined, UNDER_LOAD);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(
      () => expect(document.activeElement?.textContent).toMatch(/^Two-factor did not load/),
      UNDER_LOAD,
    );
    expect(screen.queryByRole('alert')).toBeNull();

    reachable = true;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(
      () =>
        expect(document.activeElement).toBe(
          screen.getByRole('heading', { name: 'Two-factor authentication' }),
        ),
      UNDER_LOAD,
    );
  });
});

describe('a way back is off while its request runs (sc-12537)', () => {
  function held() {
    let answer: (response: Response) => void = () => undefined;
    const response = new Promise<Response>((resolve) => {
      answer = resolve;
    });

    return { response: () => response, answer: (response: Response) => answer(response) };
  }

  async function staysOpenThenCloses(
    send: string,
    wayBack: string,
    heading: string,
    request: ReturnType<typeof held>,
    wrong: string,
  ) {
    const back = screen.getByRole('button', { name: wayBack });
    expect(back.getAttribute('aria-disabled')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: send }));
    await waitFor(() => expect(back.getAttribute('aria-disabled')).toBe('true'), UNDER_LOAD);
    expect(back.hasAttribute('data-off')).toBe(true);
    expect(screen.getByRole('button', { name: send }).getAttribute('aria-busy')).toBe('true');

    fireEvent.click(back);
    expect(screen.getByRole('heading', { name: heading })).toBeDefined();

    request.answer(problem('two_factor_code_invalid', 422));
    await screen.findByText(wrong, undefined, UNDER_LOAD);
    expect(back.getAttribute('aria-disabled')).toBe('false');
    expect(back.hasAttribute('data-off')).toBe(false);

    fireEvent.click(back);
    await waitFor(
      () => expect(screen.queryByRole('heading', { name: heading })).toBeNull(),
      UNDER_LOAD,
    );
  }

  it('on Cancel, while Check the code runs', async () => {
    const request = held();
    answering({
      'GET /api/auth/two-factor': () => json({ on: false, recoveryCodesLeft: 0 }),
      'POST /api/auth/two-factor/enrol': () => json(ENROLMENT),
      'POST /api/auth/two-factor/activate': request.response,
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn on two-factor' }, UNDER_LOAD));
    await screen.findByRole('heading', { name: 'Turn on two-factor authentication' }, UNDER_LOAD);
    fireEvent.change(screen.getByLabelText('Enter the 6-digit code the app shows'), {
      target: { value: '000000' },
    });

    await staysOpenThenCloses(
      'Check the code',
      'Cancel',
      'Turn on two-factor authentication',
      request,
      'That code does not match. Check the app was set up with the key above, then enter the code it shows now.',
    );
  });

  it('on Keep it on, while Turn it off runs', async () => {
    const request = held();
    answering({
      'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 10 }),
      'POST /api/auth/two-factor/disable': request.response,
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '000000' } });

    await staysOpenThenCloses(
      'Turn it off',
      'Keep it on',
      'Turn off two-factor authentication',
      request,
      'That code did not work. Enter the code your app shows now, or an unused recovery code.',
    );
  });

  it('on Keep current codes, while Make new codes runs', async () => {
    const request = held();
    answering({
      'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 3 }),
      'POST /api/auth/two-factor/recovery-codes': request.response,
    });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Make new codes' }, UNDER_LOAD));
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '000000' } });

    await staysOpenThenCloses(
      'Make new codes',
      'Keep current codes',
      'Make new recovery codes?',
      request,
      'That code did not work. Enter the code your app shows now, or an unused recovery code.',
    );
  });

  it('leaves the way back live after a tap that sends nothing', async () => {
    answering({ 'GET /api/auth/two-factor': () => json({ on: true, recoveryCodesLeft: 10 }) });
    card();

    fireEvent.click(await screen.findByRole('button', { name: 'Turn off two-factor' }, UNDER_LOAD));
    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }));
    expect(screen.getByText('Enter a code from your app, or a recovery code.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Keep it on' }).getAttribute('aria-disabled')).toBe(
      'false',
    );
  });
});
