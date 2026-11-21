import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../../../config.ts';
import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { apportion, checkPercents, percentOf } from './payersArea.ts';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-14T16:00:00+00:00',
  endsAt: '2030-11-16T02:00:00+00:00',
  timeZone: 'Europe/London',
  dayCount: 3,
  currency: 'GBP',
  cover: null,
  venue: null,
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

const pair = (confirmed: string, potential = confirmed) => ({ confirmed, potential });

const DINNER = {
  id: 'dinner',
  label: 'Dinner',
  category: 'catering',
  cost: pair('6528.00', '9044.00'),
  notPriced: false,
  flagged: false,
  split: {
    mode: 'percent',
    shares: [
      { payerId: 'obi', percent: '50.00' },
      { payerId: 'bakare', percent: '50.00' },
    ],
  },
};
const PHOTO = {
  id: 'photo',
  label: 'Photographer',
  category: 'photography',
  cost: pair('2000.00'),
  notPriced: false,
  flagged: false,
  split: { mode: 'one', payerId: 'obi' },
};
const CARS = {
  id: 'cars',
  label: 'Cars',
  category: 'transport',
  cost: pair('900.00'),
  notPriced: false,
  flagged: false,
  split: null,
};

const OBI = {
  id: 'obi',
  name: 'Mr and Mrs Obi',
  note: 'Adaeze’s parents',
  share: pair('5264.00', '6522.00'),
  notPriced: 0,
  paid: '1000.00',
  stillToCome: pair('4264.00', '5522.00'),
  covers: [
    {
      lineId: 'dinner',
      label: 'Dinner',
      notPriced: false,
      part: pair('3264.00', '4522.00'),
      how: { mode: 'percent', percent: '50.00' },
    },
    {
      lineId: 'photo',
      label: 'Photographer',
      notPriced: false,
      part: pair('2000.00'),
      how: { mode: 'one' },
    },
  ],
};
const BAKARE = {
  id: 'bakare',
  name: 'Mr and Mrs Bakare',
  note: null,
  share: pair('3264.00', '4522.00'),
  notPriced: 0,
  paid: '0.00',
  stillToCome: pair('3264.00', '4522.00'),
  covers: [
    {
      lineId: 'dinner',
      label: 'Dinner',
      notPriced: false,
      part: pair('3264.00', '4522.00'),
      how: { mode: 'percent', percent: '50.00' },
    },
  ],
};
const FUNMI = {
  id: 'funmi',
  name: 'Aunt Funmi',
  note: 'Covering the cars',
  share: pair('0.00'),
  notPriced: 0,
  paid: '0.00',
  stillToCome: pair('0.00'),
  covers: [],
};

function payers(fields: Record<string, unknown> = {}) {
  return {
    currency: 'GBP',
    paidShown: true,
    total: pair('9428.00', '11944.00'),
    hasPayer: pair('8528.00', '11044.00'),
    noPayer: { ...pair('900.00'), costs: 1, paid: '0.00' },
    next: { id: 'cars', label: 'Cars' },
    payers: [OBI, BAKARE, FUNMI],
    lines: [DINNER, PHOTO, CARS],
    ...fields,
  };
}

function signedIn(): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u_folake',
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

const problem = (status: number, type: string, members: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      type: `https://soirely.com/errors/${type}`,
      title: type,
      status,
      ...members,
    }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );

type Answer = (body: unknown) => Response | Promise<Response>;

function serve(
  answers: Record<string, Answer>,
  at = '/app/events/ev_1/budget/payers',
): { line: string; body: unknown }[] {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });
    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: EVENT });
    if (line === 'GET /api/events/ev_1/budget/payers') return json(payers());
    if (line === 'GET /api/events/ev_1/budget/margin') return problem(403, 'plan_required');

    return json({});
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);

  return sent;
}

const chooseWhoPays = async () =>
  (await screen.findAllByRole('button', { name: 'Choose who pays' }))[0] as HTMLElement;

const writes = (sent: { line: string }[]) => sent.filter((one) => !one.line.startsWith('GET'));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the leftover minor units (sc-91, "How a share is worked out")', () => {
  it('goes by the largest remainder, the first added between equal ones', () => {
    expect(apportion(10000, [3333, 3333, 3334], 10000)).toEqual([3333, 3333, 3334]);
    expect(apportion(123456, [3333, 3333, 3334], 10000)).toEqual([41148, 41148, 41160]);
    expect(apportion(1, [5000, 5000], 10000)).toEqual([1, 0]);
  });

  it('reads a percentage typed with either decimal mark, and refuses a third decimal', () => {
    expect(percentOf('33.33')).toBe(3333);
    expect(percentOf('33,34')).toBe(3334);
    expect(percentOf('')).toBe(0);
    expect(percentOf('33.333')).toBeNull();
  });

  it('works each payer’s amount as typed, and leaves an empty payer out', () => {
    const check = checkPercents(payers() as never, ['dinner'], { obi: '60', bakare: '40' });
    expect(check.right).toBe(true);
    expect(check.parts.get('obi')).toEqual([391680, 542640]);
    expect(check.shares).toEqual([
      { payerId: 'obi', percent: '60.00' },
      { payerId: 'bakare', percent: '40.00' },
    ]);
  });
});

describe('Who is paying (sc-91)', () => {
  it('is reached from the Budget page’s right column', async () => {
    signedIn();
    serve(
      {
        'GET /api/events/ev_1/budget': () =>
          json({
            currency: 'GBP',
            confirmed: '0.00',
            potential: '0.00',
            perHead: {
              confirmed: { amount: null, heads: 0 },
              potential: { amount: null, heads: 0 },
            },
            notPriced: 0,
            quantities: {},
            lines: [],
          }),
      },
      '/app/events/ev_1/budget',
    );

    const block = await screen.findByRole('region', { name: 'Who is paying' });
    const link = await within(block).findByRole('link', { name: /Who is paying/u });
    expect(link.getAttribute('href')).toBe('/app/events/ev_1/budget/payers');
    expect(within(block).getByText('3 payers · £900 has no payer yet')).toBeTruthy();
  });

  it('leads with the card, then a row per payer, the first added open in the pane', async () => {
    signedIn();
    serve({});

    expect(await screen.findByRole('heading', { level: 1, name: 'Who is paying' })).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Has a payer' });
    expect(within(card).getByText('£8,528 to £11,044')).toBeTruthy();
    expect(within(card).getByText('3 payers')).toBeTruthy();
    expect(
      within(card).getByText(
        'Has a payer, out of £9,428 to £11,944. £900 across 1 cost has no payer yet.',
      ),
    ).toBeTruthy();
    expect(within(card).getByText('Next: Cars has no payer yet.')).toBeTruthy();

    const pane = screen.getByRole('region', { name: 'Mr and Mrs Obi' });
    expect(within(pane).getByText('£5,264.00 to £6,522.00')).toBeTruthy();
    expect(within(pane).getByText('Paid')).toBeTruthy();
    expect(within(pane).getByText('£1,000.00')).toBeTruthy();
    expect(within(pane).getByText('£4,264.00 to £5,522.00')).toBeTruthy();
    expect(within(pane).getByText('half')).toBeTruthy();
    expect(within(pane).getByText('all of it')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Aunt Funmi/u }));
    const funmi = screen.getByRole('region', { name: 'Aunt Funmi' });
    expect(within(funmi).getByText('Nothing still to come')).toBeTruthy();
    expect(within(funmi).getByText('Replies do not change this.')).toBeTruthy();
  });

  it('shows the share alone where nothing can be paid', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/payers': () =>
        json(
          payers({
            paidShown: false,
            payers: [{ ...OBI, paid: null, stillToCome: null }, BAKARE],
          }),
        ),
    });

    const pane = await screen.findByRole('region', { name: 'Mr and Mrs Obi' });
    expect(within(pane).queryByText('Paid')).toBeNull();
    expect(within(pane).queryByText('Still to come')).toBeNull();
    expect(within(pane).getByText('Covers')).toBeTruthy();
  });

  it('refuses a blank name, a name over 60 and a name another payer has, sending nothing', async () => {
    signedIn();
    const sent = serve({});

    fireEvent.click(await screen.findByRole('button', { name: 'Add a payer' }));
    let dialog = await screen.findByRole('dialog', { name: 'Add a payer' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText('Enter a name.')).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'x'.repeat(61) } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(await within(dialog).findByText('Use 60 characters or fewer.')).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: '  aunt funmi ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(
      await within(dialog).findByText('Another payer on this event is already called Aunt Funmi.'),
    ).toBeTruthy();
    expect(writes(sent)).toEqual([]);

    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Uncle Kayode' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(writes(sent)).toEqual([
        {
          line: 'POST /api/events/ev_1/budget/payers',
          body: { name: 'Uncle Kayode', note: null },
        },
      ]),
    );
    dialog = screen.queryByRole('dialog', { name: 'Add a payer' }) as HTMLElement;
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('says the cap of 20 and opens nothing', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/payers': () =>
        json(
          payers({
            payers: Array.from({ length: 20 }, (_, index) => ({
              ...FUNMI,
              id: `p${index}`,
              name: `Payer ${index}`,
            })),
          }),
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a payer' }));
    expect(await screen.findByText('An event can have up to 20 payers.')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('refuses Remove on a payer who covers costs, and Choose who pays opens with those ticked', async () => {
    signedIn();
    const sent = serve({});

    const pane = await screen.findByRole('region', { name: 'Mr and Mrs Obi' });
    fireEvent.click(within(pane).getByRole('button', { name: 'Remove' }));
    expect(
      await screen.findByText('Mr and Mrs Obi covers 2 costs. Choose who pays for them first.'),
    ).toBeTruthy();
    expect(writes(sent)).toEqual([]);

    const refused = screen.getByRole('alert').parentElement as HTMLElement;
    fireEvent.click(within(refused).getByRole('button', { name: 'Choose who pays' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose who pays' })).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: /^Dinner/u }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(
      (screen.getByRole('checkbox', { name: /^Photographer/u }) as HTMLInputElement).checked,
    ).toBe(true);
    expect((screen.getByRole('checkbox', { name: /^Cars/u }) as HTMLInputElement).checked).toBe(
      false,
    );
  });

  it('removes a payer who covers nothing at once, with Undo', async () => {
    signedIn();
    const sent = serve({
      'DELETE /api/events/ev_1/budget/payers/funmi': () => new Response(null, { status: 204 }),
      'DELETE /api/events/ev_1/budget/payers/funmi/removal': () => json({ payer: FUNMI }),
    });

    fireEvent.click(await screen.findByRole('button', { name: /Aunt Funmi/u }));
    const pane = screen.getByRole('region', { name: 'Aunt Funmi' });
    fireEvent.click(within(pane).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Aunt Funmi removed.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(writes(sent).map((one) => one.line)).toEqual([
        'DELETE /api/events/ev_1/budget/payers/funmi',
        'DELETE /api/events/ev_1/budget/payers/funmi/removal',
      ]),
    );
  });

  it('refuses percentages that do not come to 100, saying so beside the total', async () => {
    signedIn();
    const sent = serve({});

    fireEvent.click(await chooseWhoPays());
    fireEvent.click(await screen.findByRole('checkbox', { name: /^Dinner/u }));
    fireEvent.click(screen.getByRole('radio', { name: 'Shared by percentage' }));
    fireEvent.change(screen.getByLabelText('Mr and Mrs Obi · %'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Mr and Mrs Bakare · %'), { target: { value: '40' } });
    expect(screen.getByText('£3,264.00 to £4,522.00')).toBeTruthy();
    expect(screen.getByText('Total 90.00%')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('The percentages come to 90.00. Make them add up to exactly 100.'),
    ).toBeTruthy();
    expect(writes(sent)).toEqual([]);

    fireEvent.change(screen.getByLabelText('Mr and Mrs Bakare · %'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(writes(sent)).toEqual([
        {
          line: 'PUT /api/events/ev_1/budget/payers/splits',
          body: {
            lineIds: ['dinner'],
            split: {
              mode: 'percent',
              shares: [
                { payerId: 'obi', percent: '50.00' },
                { payerId: 'bakare', percent: '50.00' },
              ],
            },
            currency: 'GBP',
          },
        },
      ]),
    );
  });

  it('refuses fixed amounts over the least the cost can be', async () => {
    signedIn();
    const sent = serve({});

    fireEvent.click(await chooseWhoPays());
    fireEvent.click(await screen.findByRole('checkbox', { name: /^Cars/u }));
    fireEvent.click(
      screen.getByRole('radio', { name: 'Fixed amounts, and one payer covers the rest' }),
    );
    fireEvent.change(screen.getByLabelText('Who covers what is left'), {
      target: { value: 'obi' },
    });
    fireEvent.change(screen.getByLabelText('Aunt Funmi · amount'), {
      target: { value: '1,000.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'The fixed amounts come to £1,000.00, more than £900.00, the least this can cost. Lower them so they fit.',
      ),
    ).toBeTruthy();
    expect(writes(sent)).toEqual([]);
  });

  it('offers only two choices with several costs ticked, and names the fixed split it replaces', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/payers': () =>
        json(
          payers({
            lines: [
              DINNER,
              {
                ...PHOTO,
                split: {
                  mode: 'fixed',
                  amounts: [{ payerId: 'funmi', amount: '400.00' }],
                  restId: 'obi',
                },
              },
              CARS,
            ],
          }),
        ),
    });

    fireEvent.click(await chooseWhoPays());
    fireEvent.click(await screen.findByRole('checkbox', { name: /^Dinner/u }));
    fireEvent.click(screen.getByRole('checkbox', { name: /^Photographer/u }));
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(
      screen.getByText(
        '2 of these costs already have a payer. Saving replaces their split, including the fixed amounts on Photographer.',
      ),
    ).toBeTruthy();
  });

  it('says a payer removed elsewhere refused the save, and reads the costs again', async () => {
    signedIn();
    let reads = 0;
    const sent = serve({
      'GET /api/events/ev_1/budget/payers': () => {
        reads += 1;

        return json(reads === 1 ? payers() : payers({ payers: [OBI, BAKARE] }));
      },
      'PUT /api/events/ev_1/budget/payers/splits': () =>
        problem(422, 'validation_failed', {
          violations: [
            {
              propertyPath: 'split.payerId',
              code: 'payer_removed',
              message:
                'Aunt Funmi was removed by someone else while this was open, so nothing was saved.',
            },
          ],
        }),
    });

    fireEvent.click(await chooseWhoPays());
    fireEvent.click(await screen.findByRole('checkbox', { name: /^Cars/u }));
    fireEvent.change(screen.getByLabelText('Payer'), { target: { value: 'funmi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'Aunt Funmi was removed by someone else while this was open, so nothing was saved.',
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(sent.filter((one) => one.line === 'GET /api/events/ev_1/budget/payers')).toHaveLength(
        2,
      ),
    );
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Aunt Funmi' })).toBeNull());
    const select = screen.getByLabelText<HTMLSelectElement>('Payer');
    expect(select.value).toBe('');
    expect(select.selectedOptions[0]?.textContent).toBe('Choose a payer');
  });

  it('leaves Choose a payer for the rest when that payer was removed elsewhere', async () => {
    signedIn();
    let reads = 0;
    const sent = serve({
      'GET /api/events/ev_1/budget/payers': () => {
        reads += 1;

        return json(reads === 1 ? payers() : payers({ payers: [OBI, BAKARE] }));
      },
      'PUT /api/events/ev_1/budget/payers/splits': () =>
        problem(422, 'validation_failed', {
          violations: [
            {
              propertyPath: 'split.restId',
              code: 'payer_removed',
              message:
                'Aunt Funmi was removed by someone else while this was open, so nothing was saved.',
            },
          ],
        }),
    });

    fireEvent.click(await chooseWhoPays());
    fireEvent.click(await screen.findByRole('checkbox', { name: /^Cars/u }));
    fireEvent.click(
      screen.getByRole('radio', { name: 'Fixed amounts, and one payer covers the rest' }),
    );
    fireEvent.change(screen.getByLabelText('Who covers what is left'), {
      target: { value: 'funmi' },
    });
    fireEvent.change(screen.getByLabelText('Mr and Mrs Obi · amount'), {
      target: { value: '100.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'Aunt Funmi was removed by someone else while this was open, so nothing was saved.',
      ),
    ).toBeTruthy();
    await waitFor(() =>
      expect(sent.filter((one) => one.line === 'GET /api/events/ev_1/budget/payers')).toHaveLength(
        2,
      ),
    );
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Aunt Funmi' })).toBeNull());
    const select = screen.getByLabelText<HTMLSelectElement>('Who covers what is left');
    expect(select.value).toBe('');
    expect(select.selectedOptions[0]?.textContent).toBe('Choose a payer');
  });

  it('flags a fixed split that no longer adds up, and Change the amounts opens it', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/payers': () =>
        json(
          payers({
            lines: [
              DINNER,
              PHOTO,
              {
                ...CARS,
                cost: pair('350.00'),
                flagged: true,
                split: {
                  mode: 'fixed',
                  amounts: [{ payerId: 'funmi', amount: '400.00' }],
                  restId: 'obi',
                },
              },
            ],
          }),
        ),
    });

    expect(
      await screen.findByText('The split on Cars no longer adds up. Nothing was changed.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Cars now costs £350.00, less than the £400.00 fixed for Aunt Funmi. £400.00 stays with Aunt Funmi and £0.00 is left for Mr and Mrs Obi until the amounts change.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Change the amounts' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose who pays' })).toBeTruthy();
    expect((screen.getByLabelText('Aunt Funmi · amount') as HTMLInputElement).value).toBe('400.00');
    expect(screen.getByText(/more than £350.00, the least this can cost/u)).toBeTruthy();
  });

  it('gives each fixed payer their own amount on the flag', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/payers': () =>
        json(
          payers({
            lines: [
              {
                ...CARS,
                cost: pair('500.00'),
                flagged: true,
                split: {
                  mode: 'fixed',
                  amounts: [
                    { payerId: 'bakare', amount: '200.00' },
                    { payerId: 'funmi', amount: '400.00' },
                  ],
                  restId: 'obi',
                },
              },
            ],
          }),
        ),
    });

    expect(
      await screen.findByText(
        'Cars now costs £500.00, less than the £600.00 fixed for Mr and Mrs Bakare and Aunt Funmi. £200.00 stays with Mr and Mrs Bakare, £400.00 stays with Aunt Funmi and £0.00 is left for Mr and Mrs Obi until the amounts change.',
      ),
    ).toBeTruthy();
  });

  it('with no payers, says what payers are for and offers Add a payer', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/payers': () =>
        json(
          payers({
            payers: [],
            lines: [{ ...CARS }],
            hasPayer: pair('0.00'),
            next: null,
          }),
        ),
    });

    expect(
      await screen.findByText(/^No payers yet\. Payers are who covers each cost/u),
    ).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Has a payer' })).toBeNull();
  });

  it('with payers and no costs, opens the first added with Edit and Remove and no figures', async () => {
    signedIn();
    const bare = { share: pair('0.00'), paid: '0.00', stillToCome: pair('0.00'), covers: [] };
    serve({
      'GET /api/events/ev_1/budget/payers': () =>
        json(
          payers({
            payers: [
              { ...OBI, ...bare },
              { ...FUNMI, ...bare },
            ],
            lines: [],
            total: pair('0.00'),
            hasPayer: pair('0.00'),
            noPayer: { ...pair('0.00'), costs: 0, paid: '0.00' },
            next: null,
          }),
        ),
    });

    const pane = await screen.findByRole('region', { name: 'Mr and Mrs Obi' });
    expect(within(pane).getByText('Adaeze’s parents')).toBeTruthy();
    expect(within(pane).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(pane).getByRole('button', { name: 'Remove' })).toBeTruthy();
    for (const gone of ['Their share', 'Paid', 'Still to come', 'Covers'])
      expect(within(pane).queryByText(gone)).toBeNull();
    expect(screen.queryByText(/£/u)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Has a payer' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Aunt Funmi/u }));
    expect(screen.getByRole('region', { name: 'Aunt Funmi' })).toBeTruthy();
  });
});

class StubSource {
  static readonly CLOSED = 2;
  static made: StubSource[] = [];

  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string | URL) {
    StubSource.made.push(this);
  }

  close(): void {
    this.readyState = StubSource.CLOSED;
  }

  publish(): void {
    act(() => this.onmessage?.({ data: '{}' }));
  }
}

describe('Who is paying while others change it (sc-91, Live)', () => {
  const before = config();

  afterEach(() => {
    __setConfig(before);
    vi.unstubAllGlobals();
  });

  const REMOVED = {
    violations: [
      {
        propertyPath: 'split.payerId',
        code: 'payer_removed',
        message:
          'Aunt Funmi was removed by someone else while this was open, so nothing was saved.',
      },
    ],
  };

  async function liveChoose(refusal: typeof REMOVED) {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
    signedIn();
    let now = payers();
    const sent = serve({
      'GET /api/events/ev_1/budget/payers': () => json(now),
      'POST /api/events/ev_1/budget/subscriptions': () =>
        json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
      'PUT /api/events/ev_1/budget/payers/splits': () => problem(422, 'validation_failed', refusal),
    });
    fireEvent.click(await chooseWhoPays());
    fireEvent.click(await screen.findByRole('checkbox', { name: /^Cars/u }));
    const budgeted = () => StubSource.made.filter((one) => String(one.url).includes('budget'));
    await waitFor(() => expect(budgeted()).toHaveLength(1));

    return {
      saves: () => sent.filter((one) => one.line.startsWith('PUT')),
      removeFunmi: async () => {
        now = payers({ payers: [OBI, BAKARE] });
        budgeted()[0]!.publish();
        await waitFor(() =>
          expect(screen.queryByRole('option', { name: 'Aunt Funmi' })).toBeNull(),
        );
      },
    };
  }

  it('refuses the save with the reason when the live list dropped the chosen payer first', async () => {
    const { saves, removeFunmi } = await liveChoose(REMOVED);
    fireEvent.change(screen.getByLabelText('Payer'), { target: { value: 'funmi' } });
    await removeFunmi();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'Aunt Funmi was removed by someone else while this was open, so nothing was saved.',
      ),
    ).toBeTruthy();
    expect(saves().map((one) => one.body)).toMatchObject([
      { split: { mode: 'one', payerId: 'funmi' } },
    ]);
    expect(screen.queryByText('Choose a payer.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose a payer.')).toBeTruthy();
    expect(saves()).toHaveLength(1);
  });

  it('refuses the save with the reason when the live list dropped the payer for the rest first', async () => {
    const { saves, removeFunmi } = await liveChoose({
      violations: [{ ...REMOVED.violations[0]!, propertyPath: 'split.restId' }],
    });
    fireEvent.click(
      screen.getByRole('radio', { name: 'Fixed amounts, and one payer covers the rest' }),
    );
    fireEvent.change(screen.getByLabelText('Who covers what is left'), {
      target: { value: 'funmi' },
    });
    fireEvent.change(screen.getByLabelText('Mr and Mrs Obi · amount'), {
      target: { value: '100.00' },
    });
    await removeFunmi();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'Aunt Funmi was removed by someone else while this was open, so nothing was saved.',
      ),
    ).toBeTruthy();
    expect(saves().map((one) => one.body)).toMatchObject([
      { split: { mode: 'fixed', restId: 'funmi' } },
    ]);
    expect(screen.queryByText('Choose who covers what is left.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Choose who covers what is left.')).toBeTruthy();
    expect(saves()).toHaveLength(1);
  });

  it('says the first share that moved, and washes every row whose share moved', async () => {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
    signedIn();
    let now = payers();
    serve({
      'GET /api/events/ev_1/budget/payers': () => json(now),
      'POST /api/events/ev_1/budget/subscriptions': () =>
        json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
    });
    const row = (name: RegExp) => screen.getByRole('button', { name });
    await screen.findByRole('button', { name: /^Mr and Mrs Obi/u });
    const budgeted = () => StubSource.made.filter((one) => String(one.url).includes('budget'));
    await waitFor(() => expect(budgeted()).toHaveLength(1));

    now = payers({
      payers: [
        { ...OBI, share: pair('2114.00', '3372.00') },
        { ...BAKARE, share: pair('6414.00', '7672.00') },
        FUNMI,
      ],
    });
    budgeted()[0]!.publish();

    expect(await screen.findByText('Mr and Mrs Obi’s share went down by £3,150.00.')).toBeTruthy();
    expect(row(/^Mr and Mrs Obi/u).className).toContain('is-washed');
    expect(row(/^Mr and Mrs Bakare/u).className).toContain('is-washed');
    expect(row(/^Aunt Funmi/u).className).not.toContain('is-washed');
    const pane = screen.getByRole('region', { name: 'Mr and Mrs Obi' });
    expect(
      within(pane).getByText('£2,114.00 to £3,372.00').closest('.bt-row')?.className,
    ).toContain('is-washed');
  });
});
