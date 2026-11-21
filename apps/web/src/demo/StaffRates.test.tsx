import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const SLOW = { timeout: 8000 };

async function open(state: string, extra = '') {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4?area=budget&state=${state}${extra}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);
  await waitFor(() => expect(document.querySelector('.bt-loading')).toBeNull(), SLOW);

  return router;
}

const main = () => screen.getByRole('main');
const job = (name: string) => within(main()).getByRole('button', { name: new RegExp(`^${name},`) });

describe('Staff rates at a desk (sc-101)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
  });

  it('heads the page with the Staff line’s figure and the hours not counted', SLOW, async () => {
    await open('staff_rates');

    expect(main().textContent).toContain('£1,502');
    expect(main().textContent).toContain(
      'From 91 h 30 min of 102 h 15 min scheduled. Bar’s 10 h 45 min not counted until it has a rate.',
    );
    expect(job('Bar').textContent).toContain('No rate yet');
    expect(job('Bar').textContent).toContain('Not counted');
    expect(job('Security').textContent).toContain('0 h · No shifts yet');
    expect(screen.getByRole('button', { name: 'Set Bar’s rate' })).toBeTruthy();
  });

  it('points the strip at the job with the most hours not counted', SLOW, async () => {
    await open('staff_rates_no_rate');

    expect(main().textContent).toContain(
      'Runner has no rate yet, so its 14 h are not in the budget.',
    );
    expect(screen.getByRole('button', { name: 'Set Runner’s rate' })).toBeTruthy();
  });

  it('keeps the pence in the headline once a rate has them', SLOW, async () => {
    await open('staff_rates');

    fireEvent.click(job('Bar'));
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '12.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rate' }));

    expect(within(main()).getByText('£1,636.38')).toBeTruthy();
  });

  it('changes a rate in place, and says who changed it from what', SLOW, async () => {
    await open('staff_rates');

    fireEvent.click(job('Waiter'));
    expect(screen.getByText('Set by Julien Moreau on Friday, Oct 16')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '15' } });
    expect(screen.getByText('29 h × £15 = £435. Kunle Ajayi keeps their own rate.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save rate' }));

    expect(job('Waiter').textContent).toContain('Changed by you just now. Was £14 an hour.');
    expect(main().textContent).toContain('£1,531');
  });

  it('follows the choice with the field’s label, and checks it before sending', SLOW, async () => {
    await open('staff_rates');

    fireEvent.click(job('Door'));
    fireEvent.change(screen.getByLabelText('Fee for each person'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rate' }));
    expect(screen.getByText('Enter the fee for each person.')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /By the hour/ }));
    expect(screen.getByText('Enter the rate an hour.')).toBeTruthy();
  });

  it(
    'says a rate was not saved under the field when Manage the budget was taken away',
    SLOW,
    async () => {
      await open('staff_rates_refused');

      expect(
        screen.getByText(
          'Not saved. Changing a rate needs the Manage the budget permission, and you no longer have it on this event. The rate is still £14 an hour.',
        ),
      ).toBeTruthy();
    },
  );

  it('removes a rate, and the job is no longer counted', SLOW, async () => {
    await open('staff_rates');

    fireEvent.click(job('Cook'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove the rate' }));

    expect(job('Cook').textContent).toContain('No rate yet');
    expect(main().textContent).toContain('Cook’s 24 h and Bar’s 10 h 45 min not counted');
  });

  it('gives a person their own rate, and takes it back', SLOW, async () => {
    await open('staff_rates_add_blank');

    expect(screen.getByText('Choose who this rate is for.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Who'), { target: { value: 'amina:waiter' } });
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '16' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add rate' }));

    const own = within(screen.getByRole('region', { name: 'People on their own rate' }));
    const amina = own.getByRole('button', { name: /^Amina Yusuf/ });
    expect(amina.textContent).toContain('£16 an hour · Instead of Waiter’s £14 an hour');
    fireEvent.click(amina);
    fireEvent.click(screen.getByRole('button', { name: 'Use Waiter’s rate' }));
    expect(screen.getByText('Amina Yusuf is back on Waiter’s rate.')).toBeTruthy();
    expect(own.queryByRole('button', { name: /^Amina Yusuf/ })).toBeNull();
  });

  it(
    'shows the rates as text, with no buttons, to someone who cannot manage the budget',
    SLOW,
    async () => {
      await open('staff_rates_read_only', '&as=ana');

      expect(main().textContent).toContain('You can see staff rates but not change them.');
      expect(within(main()).queryByRole('button', { name: /^Waiter,/ })).toBeNull();
      expect(within(main()).queryByRole('button', { name: 'Add one' })).toBeNull();
    },
  );

  it('is not available without the budget permission', SLOW, async () => {
    await open('staff_rates', '&as=kemi');

    expect(main().textContent).not.toContain('Staff rates');
  });

  it('points an event with no jobs to Staff', SLOW, async () => {
    await open('staff_rates_empty');

    expect(screen.getByRole('heading', { name: 'No jobs on this event yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Jobs and shifts' })).toBeTruthy();
  });

  it('puts the same figure on the Budget’s Staff line, which opens Staff rates', SLOW, async () => {
    await open('staff_line');

    const staff = within(main()).getByRole('link', { name: 'Staff, Staff rates' });
    expect(staff.textContent).toContain('£1,502.00');
    expect(staff.textContent).toContain('91 h 30 min of 102 h 15 min scheduled');
    expect(staff.getAttribute('href')).toContain('state=staff_rates');
  });
});

describe('Staff rates after the event (sc-234)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
  });

  it('puts Scheduled and Worked on each job, with the amount at each', SLOW, async () => {
    await open('staff_rates_after');

    const lead = within(main()).getByRole('button', { name: /^Floor lead/ });
    expect(lead.textContent).toContain('Scheduled');
    expect(lead.textContent).toContain('of which 9 h 8 min assumed (not clocked out)');
    const door = within(main()).getByRole('button', { name: /^Door/ });
    expect(door.textContent).toContain('1 person worked');
    expect(door.textContent).toContain('£120.00');
  });
});
