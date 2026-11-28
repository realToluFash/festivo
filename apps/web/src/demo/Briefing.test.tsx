import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { type BriefingStateName, BW, briefingAt } from './briefing.ts';
import { NW } from './notices.ts';
import { ISSUE_MS } from './staffLink.ts';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(
  state: BriefingStateName | null,
  at = state == null ? '' : briefingAt(state),
): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [at === '' ? '/demo/events/evt-wed-4/staff/roster' : at],
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

  it('gives a finished event House rules, opening on the rules with no Edit', async () => {
    await open('finished');
    expect(button('Edit the rules')).toBeNull();
    press('House rules');
    expect(button('Edit the rules')).toBeNull();
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
    press(BW.forBriefing(BW.markSent, 'Amina Yusuf'));
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
    const router = createMemoryRouter(routes, { initialEntries: [briefingAt('refused')] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByText(BW.refusedPage, {}, { timeout: 8000 })).toBeTruthy();
  });

  it('is the Roster itself, with its controls and the Link column beside Briefing', async () => {
    await open('populated');
    expect(button('Add a person')).toBeTruthy();
    expect(button('Text links to 4')).toBeTruthy();
    expect(button('Copy link: Tolu Bello')).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Roster' });
    const heads = within(table)
      .getAllByRole('columnheader')
      .map((one) => one.textContent);
    expect(heads).toEqual(['Name', 'Job', 'Station', 'Shift', 'Briefing', 'Link']);
  });

  it('leaves Briefing alone on a Link-column Mark as sent', async () => {
    await open('populated');
    press('Mark as sent: Amina Yusuf');
    expect(button('Send the briefing to 3')).toBeTruthy();
    expect(button('Text links to 3')).toBeTruthy();
  });

  it('turns the Link column to Link sent on a briefing Mark as sent, so Text links leaves them out', async () => {
    await open('copyCopied');
    expect(button('Text links to 4')).toBeTruthy();
    press(BW.forBriefing(BW.markSent, 'Amina Yusuf'));
    expect(button('Text links to 3')).toBeTruthy();
    expect(button('Mark as sent: Amina Yusuf')).toBeNull();
  });

  it('counts no one without a number in Send to 2 changed', async () => {
    await open('checkChanged');
    const dialog = await screen.findByRole('dialog');
    await wait(ISSUE_MS);
    expect(within(dialog).getByText('2 people')).toBeTruthy();
    expect(within(dialog).queryByText(/no mobile number/)).toBeNull();
  }, 15_000);

  it('keeps the Roster’s own states without the briefing', async () => {
    await open(null);
    expect(screen.queryByRole('heading', { name: BW.card })).toBeNull();
    expect(button('Add a person')).toBeTruthy();
  });
  it('offers no Copy link in the copy list to a person with no mobile number (sc-3912)', async () => {
    await open('copyList');
    expect(button('Copy link for the briefing: Ada Nnaji')).toBeNull();
    expect(button('Copy link for the briefing: Amina Yusuf')).toBeTruthy();
  });

  it('sends Give someone a shift to the Jobs and shifts tab', async () => {
    await open('copyNobody');
    const link = screen.getByRole('link', { name: BW.giveShift });
    expect(link.getAttribute('href')).toBe('/demo/events/evt-wed-4/staff/jobs');
  });

  it('keeps the draft when the rules are not saved, and saves on the next press', async () => {
    await open('rulesNotSaved');
    expect(screen.getByRole('alert').textContent).toContain(BW.notSaved);
    press(BW.save);
    expect(screen.queryByText(BW.notSaved)).toBeNull();
    expect(screen.getByText(/No phones on the floor\./)).toBeTruthy();
  });

  it('loads Preview as again after it failed', async () => {
    await open('previewFailed');
    expect(screen.getByText(BW.didNotWork)).toBeTruthy();
    press(BW.tryAgain);
    expect(screen.getByText(BW.previewLoading)).toBeTruthy();
    await wait(ISSUE_MS);
    expect(screen.getByRole('group', { name: 'Amina Yusuf’s page' })).toBeTruthy();
  });

  it('refuses a send on a page opened before End now, and reloads it Finished (sc-4333)', async () => {
    await open('noticesFinishedRefusedBefore');
    expect(document.getElementById('sv-over')).toBeNull();
    const sends = screen.getAllByRole('button', { name: /^Send/ });
    fireEvent.click(sends[0] as HTMLElement);
    expect(document.getElementById('sv-over')?.textContent).toContain(NW.alreadyOver);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Send/ })).toBeNull();
  });

  it('offers no Copy link and no Edit the rules once the event is Finished, as a finished event (sc-4333)', async () => {
    for (const state of [
      'noticesCalledOff',
      'noticesEventEnded',
      'noticesFinishedSent',
      'noticesFinishedSwitchOff',
      'noticesFinishedRefused',
    ] as const) {
      await open(state);
      expect(screen.queryByRole('button', { name: /Copy link/ })).toBeNull();
      expect(button('Edit the rules')).toBeNull();
      expect(button('House rules')).toBeTruthy();
      expect(button('Preview as')).toBeTruthy();
      cleanup();
    }
    await open('noticesFinishedRefusedBefore');
    expect(screen.queryAllByRole('button', { name: /Copy link/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: /^Send/ })[0] as HTMLElement);
    expect(screen.queryByRole('button', { name: /Copy link/ })).toBeNull();
    expect(button('Edit the rules')).toBeNull();
  });

  it('says under the roster that changes reach the briefed, until the event is Finished (sc-4333)', async () => {
    await open('noticesList');
    expect(screen.getByText(NW.footnote)).toBeTruthy();
    cleanup();
    await open('noticesCalledOff');
    expect(screen.queryByText(NW.footnote)).toBeNull();
  });

  it('keeps Reminder the day before between the card and the Roster with details docked (sc-102333)', async () => {
    await open('docked');
    const card = screen.getByRole('region', { name: NW.card });
    const roster = screen.getByRole('table', { name: 'Roster' });
    expect(card.compareDocumentPosition(roster) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers Add credits to billing.manage when the reminder’s credits fall short, opening Plan and billing (sc-4333)', async () => {
    await open('noticesCostShort');
    const card = screen.getByRole('region', { name: NW.card });
    expect(within(card).getByText(NW.short(1))).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'Add credits' }).getAttribute('href')).toBe(
      '/demo/settings/plan-and-billing?state=packs',
    );
    expect(within(card).queryByRole('button', { name: /Buy credits|Ask an owner/ })).toBeNull();
  });

  it('offers Ask an owner to anyone else, with its sent and not-sent lines (sc-4333)', async () => {
    await open('noticesCostShortAskFailed');
    const card = screen.getByRole('region', { name: NW.card });
    expect(within(card).getByRole('alert').textContent).toBe('Not sent. Try again in a moment.');
    expect(within(card).queryByRole('link', { name: 'Add credits' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Ask an owner' }));
    await wait(600);
    expect(
      within(card).getByText('The owners have been sent the link to Plan and billing.'),
    ).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Ask an owner' })).toBeNull();
  });
});
