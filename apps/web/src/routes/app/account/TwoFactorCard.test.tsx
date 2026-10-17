import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

function answering(answers: Record<string, () => Response>) {
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
  render(<TwoFactorCard email="folake@ire.events" onBusy={onBusy} />);

  return onBusy;
}

// Several round trips each, more than findBy's default second under the full suite's load.
const UNDER_LOAD = { timeout: 3000 };

afterEach(() => vi.restoreAllMocks());

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

    await screen.findByRole('heading', { name: 'Turn on two-factor authentication' }, UNDER_LOAD);
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

    await screen.findByRole('heading', { name: 'Save your recovery codes' }, UNDER_LOAD);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);

    const finish = screen.getByRole('button', { name: 'Finish' }) as HTMLButtonElement;
    expect(finish.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('I have saved these codes somewhere safe'));
    expect(finish.disabled).toBe(false);
    fireEvent.click(finish);

    await screen.findByText('10 of 10 unused · each works once', undefined, UNDER_LOAD);
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

    fireEvent.click(screen.getByRole('button', { name: 'Make new codes' }));
    expect(screen.getByText('Enter a code from your app, or a recovery code.')).toBeDefined();
    expect(sent.filter((r) => r.path.endsWith('/recovery-codes'))).toEqual([]);

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make new codes' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Copy all' }, UNDER_LOAD));

    await screen.findByText('All 10 codes are on your clipboard.', undefined, UNDER_LOAD);
    expect(writeText).toHaveBeenCalledWith(CODES.join('\n'));
    expect(sent.find((r) => r.path.endsWith('/recovery-codes'))?.body).toEqual({ code: '123456' });
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
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

    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }));
    expect(screen.getByText('Enter a code from your app, or a recovery code.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'abcd-efgh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn it off' }));

    await waitFor(() => expect(screen.getByText('Off')).toBeDefined(), UNDER_LOAD);
    expect(screen.getByRole('button', { name: 'Turn on two-factor' })).toBeDefined();
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
