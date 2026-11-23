import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { cssRule, stylesheet } from '../test-styles.ts';
import { noticesAsked } from './ruleNotices.ts';

const tested = config();

async function open(path: string, heading: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  const title = await screen.findByRole('heading', { level: 1, name: heading });

  return { router, title };
}

function follows(earlier: Node, later: Node): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe('The sign-in rules’ notices above the title row (sc-39471, #87355)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('reads ?notice= in the product’s order, and a held General as its notice', () => {
    expect(noticesAsked(new URLSearchParams('notice=changed,gate,nope'))).toEqual([
      'gate',
      'changed',
    ]);
    expect(noticesAsked(new URLSearchParams('state=heldTwoFactor'))).toEqual(['gate']);
    expect(noticesAsked(new URLSearchParams('state=heldLinked'))).toEqual(['unlinked']);
    expect(noticesAsked(new URLSearchParams(''))).toEqual([]);
  });

  it('stands on General under the offline box and above the title, inside the page', async () => {
    const { title } = await open(
      '/demo/settings/general?as=julien&notice=gate,changed&offline',
      'General',
    );
    const offline = screen.getByText(/Offline · as of/);
    const gate = screen.getByText('Two-factor required by Ire Events');
    const changed = screen.getByText('Sign-in rules changed');

    expect(follows(offline, gate)).toBe(true);
    expect(follows(gate, changed)).toBe(true);
    expect(follows(changed, title)).toBe(true);
    expect(screen.getByRole('link', { name: 'Turn on two-factor' }).getAttribute('href')).toBe(
      '/demo/settings/security?as=julien',
    );
  });

  it('shows the two-factor gate on General held until two-factor', async () => {
    await open('/demo/settings/general?as=julien&state=heldTwoFactor', 'General');

    expect(screen.getByText('Two-factor required by Ire Events')).toBeDefined();
  });

  it('puts a notice away with Not now and lands on what follows', async () => {
    await open('/demo/settings/general?as=julien&notice=gate,changed', 'General');

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() => expect(screen.queryByText('Two-factor required by Ire Events')).toBeNull());
    expect(screen.getByText('Sign-in rules changed')).toBeDefined();
  });

  it('stands above Events’ title', async () => {
    const events = await open('/demo/events?notice=due', 'Events');
    expect(follows(screen.getByText(/requires two-factor from/), events.title)).toBe(true);
  });

  it('keeps 18 between the boxes and to the title row on the Calendar (#87445)', async () => {
    const calendar = await open('/demo/calendar?notice=changed&offline', 'Calendar');
    const stack = screen.getByText('Sign-in rules changed').closest('.rn-stack');
    const rule = cssRule('.rn-stack', stylesheet(import.meta.dirname, 'ruleNotices.css'));

    expect(stack?.contains(screen.getByText(/Offline · as of/))).toBe(true);
    expect(follows(stack as Node, calendar.title)).toBe(true);
    expect(rule).toContain('gap: 18px;');
    expect(rule).toContain('margin-bottom: 18px;');
  });
});
