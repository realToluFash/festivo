import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { OPEN, SEND_MS, stepBack } from './guest.ts';
import { GUEST_LINK_PAGES } from './guestLink.ts';

const tested = config();

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('banner');
}

async function wait(ms: number): Promise<void> {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  __setConfig(tested);
  vi.useRealTimers();
});

describe('an answer link from the invitation, on the guest’s page (sc-1291)', () => {
  it('lists every state once on the demo home', async () => {
    await open('/demo');
    const hrefs = screen.getAllByRole('link').map((one) => one.getAttribute('href'));

    for (const state of GUEST_LINK_PAGES.flatMap((one) => one.states))
      expect(hrefs.filter((href) => href === state.to)).toHaveLength(1);
  });

  it('opens Not coming chosen from the message, and records only at Confirm', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('/demo/guest?state=linkNotComing');

    expect(screen.getByRole('heading', { name: 'Confirm your answer' })).toBeDefined();
    expect(screen.getByText('From your message')).toBeDefined();
    expect(screen.queryByText('Your companions won’t be coming either.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose a different answer' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await wait(SEND_MS);

    expect(screen.getByRole('heading', { name: 'You’re down as not coming.' })).toBeDefined();
  });

  it('carries Coming on into Who’s coming, recording nothing yet', async () => {
    await open('/demo/guest?state=linkComingCarryOn');
    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }));

    expect(screen.queryByText(/You’re down as/u)).toBeNull();
    expect(document.querySelector('[data-focus="withYouHead"]')).not.toBeNull();
  });

  it('returns from Who’s coming, and from the kitchen through it, to Coming still chosen', async () => {
    await open('/demo/guest?state=linkComingCarryOn');
    const back = () => fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    const onTheLink = () => {
      expect(screen.getByRole('heading', { name: 'Confirm your answer' })).toBeDefined();
      expect(screen.getByText('From your message')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Carry on' })).toBeDefined();
      expect(screen.queryByText(/You’re down as/u)).toBeNull();
    };

    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }));
    back();
    onTheLink();

    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Anything the kitchen must know?' })).toBeDefined();
    back();
    expect(screen.getByRole('heading', { name: 'Who’s coming with you?' })).toBeDefined();
    back();
    onTheLink();
  });

  it('confirms Coming at once where no Yes step applies, and drops Yes’s chevron', async () => {
    await open('/demo/guest?state=linkComingConfirm');

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Choose a different answer' }));

    expect(screen.getByRole('button', { name: 'Yes, I’ll be there' })).toBeDefined();
    expect(document.querySelector('.gp-chev')).toBeNull();
  });

  it('shows the earlier answer and its date above a different one', async () => {
    await open('/demo/guest?state=linkChanged');

    expect(screen.getByText(/^You answered Coming on /u)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
  });

  it('has nothing to confirm when the link’s answer is the one already given', async () => {
    await open('/demo/guest?state=linkSame');

    expect(screen.getByRole('heading', { name: 'You’re already down as coming.' })).toBeDefined();
    expect(screen.getByText(/There is nothing to confirm\.$/u)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
  });

  it('says the companions won’t be coming either, before Confirm', async () => {
    await open('/demo/guest?state=linkCompanions');
    const note = screen.getByText('Your companions won’t be coming either.');
    const confirm = screen.getByRole('button', { name: 'Confirm' });

    expect(note.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('keeps the answer chosen when Confirm was not sent, and records at Confirm again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open('/demo/guest?state=linkNotSent');

    expect(
      screen.getByText('Your answer was not sent. Everything you chose is still here. Try again.'),
    ).toBeDefined();
    expect(screen.getByText('From your message')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.queryByText(/Your answer was not sent/u)).toBeNull();
    await wait(SEND_MS);

    expect(screen.getByRole('heading', { name: 'You’re down as not coming.' })).toBeDefined();
  });

  it('opens with nothing chosen and no error for a link with no answer', async () => {
    await open('/demo/guest?state=linkNoAnswer');

    expect(screen.getByRole('heading', { name: 'Your answer' })).toBeDefined();
    expect(screen.queryByText('From your message')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Back from a Yes step (sc-1291)', () => {
  it('returns a link’s step, the kitchen first among them, to Coming chosen with nothing recorded', () => {
    expect(stepBack('link')).toEqual({ kind: 'link', picked: 'coming', busy: false });
    expect(stepBack('changing')).toEqual({ kind: 'changing', busy: null });
    expect(stepBack('answer')).toBe(OPEN);
  });
});
