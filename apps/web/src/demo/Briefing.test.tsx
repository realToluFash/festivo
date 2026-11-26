import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { BW } from './briefing.ts';
import { ISSUE_MS } from './staffLink.ts';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/staff/briefing?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, { timeout: 8000 });
}

const button = (name: string) => screen.queryByRole('button', { name });
const press = (name: string) => fireEvent.click(button(name) as HTMLElement);
const wait = (ms: number) => act(() => new Promise((done) => setTimeout(done, ms + 50)));

describe('the briefing on the web (sc-3917)', () => {
  it('shows the card’s buttons with their counts, and the column’s notes', async () => {
    await open('populated');
    expect(button('Send the briefing to 3')).toBeTruthy();
    expect(button('Send to 2 changed')).toBeTruthy();
    expect(button('Copy link')).toBeTruthy();
    expect(button('Edit the rules')).toBeTruthy();
    expect(button('Send again: Sade Lawal')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Roster' });
    expect(within(table).getByText(BW.noMobile)).toBeTruthy();
    expect(within(table).getByText(BW.noShift)).toBeTruthy();
  });

  it('hides the send buttons before epic 36, and every action for staff.read', async () => {
    await open('notLive');
    expect(screen.queryByRole('button', { name: /^Send/ })).toBeNull();
    expect(button('Copy link')).toBeTruthy();
  });

  it('gives staff.read House rules and Preview as, with nothing to send or copy', async () => {
    await open('readOnly');
    expect(screen.queryByRole('button', { name: /^Send|Copy link/ })).toBeNull();
    expect(button('House rules')).toBeTruthy();
    expect(button('Preview as')).toBeTruthy();
  });

  it('sends after the check, and the result counts who has no number', async () => {
    await open('checkEnough');
    const dialog = await screen.findByRole('dialog');
    await wait(ISSUE_MS);
    expect(within(dialog).getByText('Credits after sending: 1,345.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send the briefing to 3' }));
    await wait(ISSUE_MS);
    expect(screen.getByText('Sent to 3.')).toBeTruthy();
    expect(screen.getByText('1 has no mobile number.')).toBeTruthy();
    expect(button('Send the briefing to 3')).toBeNull();
  }, 15_000);

  it('says what waits for credits, with Add credits', async () => {
    await open('checkWhatsAppShort');
    const dialog = await screen.findByRole('dialog');
    await wait(ISSUE_MS);
    expect(within(dialog).getByText('1 SMS message will wait for credits.')).toBeTruthy();
    expect(within(dialog).getByText('1 WhatsApp message will wait for credits.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Add credits' })).toBeTruthy();
  }, 15_000);

  it('marks a copied link as sent from the copy list, and recounts', async () => {
    await open('copyCopied');
    press('Mark as sent: Amina Yusuf');
    expect(button('Send the briefing to 2')).toBeTruthy();
    expect(screen.getAllByText('Marked as sent by Amara Nwosu · 19:12').length).toBeGreaterThan(0);
  });

  it('shows the count at the limit and keeps a paste to 2,000', async () => {
    await open('rulesEdit');
    const box = screen.getByRole('textbox', { name: 'House rules' });
    fireEvent.change(box, { target: { value: 'a'.repeat(2100) } });
    expect(screen.getByText(BW.atLimit)).toBeTruthy();
    expect(screen.getAllByText(BW.cut).length).toBeGreaterThan(0);
    expect((box as HTMLTextAreaElement).value).toHaveLength(2000);
  });

  it('refuses without either permission', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/demo/events/evt-wed-4/staff/briefing?state=refused'],
    });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText(BW.refusedPage, {}, { timeout: 8000 })).toBeTruthy();
  });
});
