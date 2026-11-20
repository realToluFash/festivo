import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { sample } from './roster.ts';
import { ISSUE_MS } from './staffLink.ts';
import { SENT_MS, TW, bulkCheck, owed, textSome, texting } from './staffText.ts';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/staff/roster?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, { timeout: 8000 });
}

const button = (name: string) => screen.queryByRole('button', { name });
const press = (name: string) => fireEvent.click(button(name) as HTMLElement);
const wait = (ms: number) => act(() => new Promise((done) => setTimeout(done, ms + 50)));
const table = () => screen.getByRole('table', { name: 'Roster' });
const said = (words: string) => screen.getAllByText(words).length > 0;

describe('texting staff links on the web roster (sc-77904)', () => {
  it('shows neither button before SMS is merged', async () => {
    await open('populated');
    expect(button('Text the link: Tolu Bello')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Text links to/ })).toBeNull();
  });

  it('checks one text, then reads Sending text… until sent, then Link sent', async () => {
    await open('smsOn');
    press('Text the link: Tolu Bello');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/This text uses 62 credits\./)).toBeTruthy();
    expect(within(dialog).getByText(/Credits after sending: 1,438\./)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Text the link' }));
    await wait(ISSUE_MS);
    expect(within(table()).getByText('Sending text…')).toBeTruthy();
    expect(said('Sending the link to Tolu Bello.')).toBe(true);
    expect(button('Text the link: Tolu Bello')).toBeNull();
    await wait(SENT_MS);
    expect(within(table()).getByText('Sent by Amara Nwosu · 19:12')).toBeTruthy();
  }, 15_000);

  it('keeps Link opened when an opened link is texted', async () => {
    await open('smsOn');
    press('Text the link: Grace Udo');
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Text the link' }),
    );
    await wait(ISSUE_MS + SENT_MS);
    expect(within(table()).getByText('Opened 19:05')).toBeTruthy();
  }, 15_000);

  it('says so in the check when the press is refused, the status unchanged', async () => {
    await open('textNotSent');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('alert').textContent).toBe(
      'That did not work. Try again in a moment.',
    );
  });

  it('holds a text with no credits: the line, no Text the link, Copy link kept', async () => {
    await open('textHeld');
    expect(within(table()).getByText('Text held: no credits')).toBeTruthy();
    expect(button('Text the link: Tolu Bello')).toBeNull();
    expect(button('Copy link: Tolu Bello')).toBeTruthy();
  });

  it('withdraws a waiting text on Mark as sent', async () => {
    await open('textWaits');
    expect(within(table()).getByText('Text waits until 09:00, their time')).toBeTruthy();
    press('Copy link: Tolu Bello');
    await wait(ISSUE_MS);
    press('Mark as sent: Tolu Bello');
    expect(within(table()).queryByText('Text waits until 09:00, their time')).toBeNull();
  });

  it('brings Text the link back after a text is not delivered, and counts the person again', async () => {
    await open('textUndelivered');
    expect(within(table()).getByText('Text not delivered · 19:12')).toBeTruthy();
    expect(button('Text the link: Tolu Bello')).toBeTruthy();
    expect(button('Text links to 5')).toBeTruthy();
  });

  it('gives a person with no mobile number no Text the link', async () => {
    await open('smsOn');
    expect(button('Text the link: Ada Nnaji')).toBeNull();
    expect(within(table()).getByText('Add a mobile number to send a link')).toBeTruthy();
  });

  it('says Stopped texts where Text the link would be, and skips them', async () => {
    await open('stopped');
    expect(within(table()).getByText('Stopped texts')).toBeTruthy();
    expect(button('Text the link: Chinedu Eze')).toBeNull();
    expect(button('Copy link: Chinedu Eze')).toBeTruthy();
    expect(button('Text links to 4')).toBeTruthy();
  });

  it('checks Text links to 5, and the result says Sending, counting each person once', async () => {
    await open('smsOn');
    press('Text links to 5');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Texts use 310 credits\./)).toBeTruthy();
    expect(within(dialog).getByText(/Credits after sending: 1,190\./)).toBeTruthy();
    expect(within(dialog).getByText('1 has no mobile number.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Text links to 5' }));
    await wait(ISSUE_MS);
    expect(said('Sending to 5 people.')).toBe(true);
    expect(within(table()).getAllByText('Sending text…')).toHaveLength(5);
    expect(screen.queryByRole('button', { name: /^Text links to/ })).toBeNull();
    expect(screen.getByText(TW.allSent)).toBeTruthy();
  });

  it('says what waits for credits, with Add credits', async () => {
    await open('bulkCheckShort');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('3 SMS messages will wait for credits.')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Add credits' })).toBeTruthy();
  });

  it('shows sc-3946’s wait line at night', async () => {
    await open('bulkCheckQuiet');
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText('Texts to 5 people wait until 09:00, their time.'),
    ).toBeTruthy();
  });

  it('shows neither button without staff.manage', async () => {
    await open('smsReadOnly');
    expect(button('Text the link: Tolu Bello')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Text links to/ })).toBeNull();
  });
});

describe('the result after Text links to {n}', () => {
  it('leaves out each sentence at 0, every one with its full stop', () => {
    const base = { sending: 0, m: 0, k: 0, held: 0, waits: 0, time: '09:00' };
    expect(TW.result({ ...base, sending: 1 })).toEqual(['Sending to 1 person.']);
    expect(TW.result({ ...base, sending: 2, m: 1, k: 1, held: 3, waits: 1 })).toEqual([
      'Sending to 2 people.',
      '1 has no mobile number.',
      '1 has stopped texts.',
      '3 held: no credits.',
      '1 waits until 09:00, their time.',
    ]);
    expect(TW.result({ ...base, m: 2, waits: 5 })).toEqual([
      '2 have no mobile number.',
      '5 wait until 09:00, their time.',
    ]);
  });

  it('sends what the credits cover and holds the rest, then counts nobody owed', () => {
    const entries = sample();
    const ids = entries.filter(owed).map((one) => one.id);
    const pressed = textSome(entries, ids, texting({ credits: 150 }));
    expect(pressed.result.sending).toBe(2);
    expect(pressed.result.held).toBe(ids.length - 2);
    expect(bulkCheck(pressed.entries, texting({ credits: pressed.credits })).n).toBe(0);
  });
});
