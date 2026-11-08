import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

async function settings(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('navigation', { name: 'Settings' });

  return router;
}

const ask = (name: string) => screen.getByRole('alertdialog', { name });
const who = () => screen.getByRole('button', { name: /^Hand (them|it) to:/u });
const options = () => within(screen.getByRole('listbox')).getAllByRole('option');
const key = (target: Element, name: string) => fireEvent.keyDown(target, { key: name });

async function wait(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

describe('handing over a departing member’s work at a desk (sc-31311)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => vi.useRealTimers());

  it('asks who takes Priya’s events in Members’ own confirm, starting on you', async () => {
    await settings('/demo/settings/members?state=handover');
    const dialog = ask('Remove Priya Shah from Ire Events?');

    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      document.getElementById(dialog.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe('Priya Shah leads 3 events. Hand them to:');
    expect(who().getAttribute('aria-label')).toBe('Hand them to: Folake Adeyemi · you');
    expect(who().getAttribute('aria-haspopup')).toBe('listbox');
    const moves = within(dialog).getByRole('list', { name: 'What will move, 3 events' });
    expect(
      within(moves)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Adaeze & Tunde’s wedding', 'Ireti at 40', 'Team offsite']);
    expect(within(dialog).getByText('They lose access on their next request.')).toBeDefined();
    expect(document.activeElement?.textContent).toBe('Keep Priya');
  });

  it('opens the menu of people as a listbox and moves through it by keyboard', async () => {
    await settings('/demo/settings/members?state=handover');

    key(who(), 'ArrowDown');
    expect(who().getAttribute('aria-expanded')).toBe('true');
    expect(options().map((one) => one.textContent)).toEqual([
      'FAFolake Adeyemi · you',
      'JMJulien Moreau',
      'ASAna Souza',
      'TBTom Becker',
      'KMKofi Mensah',
    ]);
    expect(document.activeElement).toBe(options()[0]);
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');
    key(options()[0] as Element, 'ArrowDown');
    expect(document.activeElement).toBe(options()[1]);
    key(options()[1] as Element, 'End');
    expect(document.activeElement).toBe(options()[4]);
    key(options()[4] as Element, 'a');
    expect(document.activeElement?.textContent).toBe('ASAna Souza');
    key(document.activeElement as Element, 'Enter');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(who().getAttribute('aria-label')).toBe('Hand them to: Ana Souza');
    expect(document.activeElement).toBe(who());
  });

  it('closes the menu on Escape with nothing changed and the confirm still open, and moves on with Tab', async () => {
    await settings('/demo/settings/members?state=handover');

    key(who(), 'ArrowUp');
    expect(document.activeElement?.textContent).toBe('KMKofi Mensah');
    key(document.activeElement as Element, 'Escape');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(ask('Remove Priya Shah from Ire Events?')).toBeDefined();
    expect(who().getAttribute('aria-label')).toBe('Hand them to: Folake Adeyemi · you');
    expect(document.activeElement).toBe(who());

    fireEvent.click(who());
    key(document.activeElement as Element, 'Tab');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement?.textContent).toBe('Keep Priya');
  });

  it('removes Priya, hands her events to the one picked and says so on the card', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=handoverPicked');
    const dialog = ask('Remove Priya Shah from Ire Events?');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    const busy = within(dialog).getByRole('button', { name: 'Removing…' });
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.getAttribute('aria-disabled')).toBe('true');
    expect(busy.hasAttribute('disabled')).toBe(false);
    expect(who().getAttribute('aria-disabled')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(ask('Remove Priya Shah from Ire Events?')).toBeDefined();
    await wait(600);

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Priya Shah was removed')).toBeDefined();
    expect(
      screen.getByText(
        'Their 3 events are now led by Ana Souza, who is emailed the list. They are listed under Former, with everything they did kept.',
      ),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe(
        'Priya Shah was removedTheir 3 events are now led by Ana Souza, who is emailed the list. They are listed under Former, with everything they did kept.',
      ),
    );
  });

  it('sends you no email when you take the events yourself', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=handover');

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await wait(600);

    expect(
      screen.getByText(
        'Their 3 events are now led by you. They are listed under Former, with everything they did kept.',
      ),
    ).toBeDefined();
  });

  it('lists the first five of a long list, then how many more', async () => {
    await settings('/demo/settings/members?state=handoverLong');
    const dialog = ask('Remove Julien Moreau from Ire Events?');

    expect(within(dialog).getByRole('list', { name: 'What will move, 8 events' })).toBeDefined();
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(5);
    expect(within(dialog).getByText('and 3 more')).toBeDefined();
  });

  it('says one event in its words for 1', async () => {
    await settings('/demo/settings/members?state=handoverOne');
    const dialog = ask('Remove Priya Shah from Ire Events?');

    expect(within(dialog).getByText('Priya Shah leads 1 event. Hand it to:')).toBeDefined();
    expect(who().getAttribute('aria-label')).toBe('Hand it to: Folake Adeyemi · you');
    expect(within(dialog).getByRole('list', { name: 'What will move, 1 event' })).toBeDefined();
  });

  it('cuts a long name, keeps the whole of it to read, and shows a called-off event like any other', async () => {
    await settings('/demo/settings/members?state=handoverLongNames');
    const rows = within(ask('Remove Priya Shah from Ire Events?')).getAllByRole('listitem');
    const long =
      'Festa de encerramento da conferência anual das associações de antigos alunos de Lisboa';

    expect(rows.map((row) => row.textContent)).toEqual([
      'Adaeze & Tunde’s wedding',
      long,
      'Team offsite',
    ]);
    expect(rows[1]?.querySelector('.handover-move-name')?.getAttribute('title')).toBe(long);
    expect(rows[2]?.className).toBe(rows[0]?.className);
  });

  it('offers no verb while the work list is on its way, and Keep still closes it', async () => {
    await settings('/demo/settings/members?state=handoverLoading');
    const dialog = ask('Remove Priya Shah from Ire Events?');

    expect(within(dialog).getByRole('status').textContent).toBe('Checking what Priya Shah leads…');
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Hand / })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Priya' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('offers Try again, not Remove, when the work list fails, then asks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=handoverLoadFailed');
    const dialog = ask('Remove Priya Shah from Ire Events?');

    expect(within(dialog).getByRole('alert').textContent).toBe(
      'What Priya Shah leads did not load. Nothing was changed.',
    );
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(within(ask('Remove Priya Shah from Ire Events?')).getByRole('status')).toBeDefined();
    await wait(1300);
    expect(who().getAttribute('aria-label')).toBe('Hand them to: Folake Adeyemi · you');
  });

  it('says the server’s refusal in its own words, and Remove goes through', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=handoverRefused');
    const dialog = ask('Remove Tom Becker from Ire Events?');

    expect(within(dialog).getByRole('alert').textContent).toBe(
      'Choose who takes over their events.',
    );
    expect(within(dialog).getByText('Tom Becker leads 2 events. Hand them to:')).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await wait(600);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('holds back Hand over now until Marta’s work list is in', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=martaLoadFailed');

    expect(screen.getByRole('alert').textContent).toBe(
      'What Marta Silva leads did not load. Nothing was changed.',
    );
    expect(screen.queryByRole('button', { name: 'Hand over now' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status').textContent).toBe('Checking what Marta Silva leads…');
    await wait(1300);
    expect(screen.getByRole('button', { name: 'Hand over now' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Leads 2 events' })).toBeDefined();
  });

  it('leaves in the words for 1', async () => {
    await settings('/demo/settings/general?state=leaveOne&as=ana');
    const dialog = ask('Leave Ire Events?');

    expect(within(dialog).getByText('You lead 1 event. Hand it to:')).toBeDefined();
    expect(who().getAttribute('aria-label')).toBe('Hand it to: Nobody: the owners take it');
  });

  it('offers no Leave while your work list is on its way, and Stay still closes it', async () => {
    await settings('/demo/settings/general?state=leaveLoading&as=ana');
    const dialog = ask('Leave Ire Events?');

    expect(within(dialog).getByRole('status').textContent).toBe('Checking what you lead…');
    expect(within(dialog).queryByRole('button', { name: /^Leave/u })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /^Hand / })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('offers Try again, not Leave, when your work list fails, then asks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/general?state=leaveLoadFailed&as=ana');
    const dialog = ask('Leave Ire Events?');

    expect(within(dialog).getByRole('alert').textContent).toBe(
      'What you lead did not load. Nothing was changed.',
    );
    expect(within(dialog).queryByRole('button', { name: /^Leave/u })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }));
    expect(within(ask('Leave Ire Events?')).getByRole('status')).toBeDefined();
    await wait(1300);
    expect(who().getAttribute('aria-label')).toBe('Hand them to: Nobody: the owners take them');
  });

  it('searches above 15 people, says how many match, and clears', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=handoverSearch');
    const field = screen.getByRole('searchbox', { name: 'Search members' });

    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(options().map((one) => one.textContent?.slice(2))).toEqual([
      'Joana Ferreira',
      'Jonas Weber',
      'João Pereira',
    ]);
    await wait(600);
    expect(within(screen.getByRole('alertdialog')).getByRole('status').textContent).toBe(
      '3 members match',
    );
    key(field, 'ArrowDown');
    expect(document.activeElement).toBe(options()[0]);

    fireEvent.change(field, { target: { value: 'kemi' } });
    expect(screen.queryByRole('listbox')).toBeNull();
    const none = screen.getByText('Nobody in Ire Events matches “kemi”.');
    fireEvent.click(within(none.parentElement as HTMLElement).getByRole('button'));
    expect(options()).toHaveLength(16);
    expect(document.activeElement).toBe(field);
  });

  it('keeps today’s confirm and card, word for word, for someone who leads nothing', async () => {
    await settings('/demo/settings/members?state=removingNoWork');
    const dialog = ask('Remove Tom Becker from Ire Events?');

    expect(
      within(dialog).getByText(
        'They lose access on their next request. Their events stay with Ire Events.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Hand them to/u })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(screen.getByText('Tom Becker was removed')).toBeDefined();
    expect(
      screen.getByText(
        'Their events stay with Ire Events. They are listed under Former, with everything they did kept.',
      ),
    ).toBeDefined();
  });

  it('says a failed removal changed nothing, and tries again from the verb', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=handoverFailed');
    const dialog = ask('Remove Priya Shah from Ire Events?');

    expect(within(dialog).getByRole('alert').textContent).toBe(
      'Removing did not work. Nothing was changed. Try again in a moment.',
    );
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Remove'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await wait(600);

    expect(screen.getByText('Priya Shah was removed')).toBeDefined();
  });

  it('holds Removing… from its link, then lands', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=handoverSending');

    expect(screen.getByRole('button', { name: 'Removing…' })).toBeDefined();
    await wait(8100);
    expect(screen.getByText('Priya Shah was removed')).toBeDefined();
  });

  it('shows what a suspended member leads, and hands it over now without removing them', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await settings('/demo/settings/members?state=marta');
    const block = screen.getByRole('heading', { name: 'Leads 2 events' }).closest('section');

    expect(
      within(block as HTMLElement)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Ire Events end-of-year party', 'Cena benéfica Fundación Lucía']);
    const now = within(block as HTMLElement).getByRole('button', { name: 'Hand over now' });
    now.focus();
    fireEvent.click(now);
    const dialog = ask('Hand over Marta Silva’s events?');
    expect(within(dialog).getByText('Restoring Marta Silva won’t give them back.')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Hand over' }).className).not.toContain(
      'is-red',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(now));

    fireEvent.click(now);
    fireEvent.click(screen.getByRole('button', { name: 'Hand over' }));
    expect(screen.getByRole('button', { name: 'Handing over…' })).toBeDefined();
    await wait(600);

    expect(screen.queryByRole('heading', { name: 'Leads 2 events' })).toBeNull();
    expect(screen.getByText('Their 2 events are now led by you.')).toBeDefined();
    expect(screen.getByText('Restoring Marta Silva won’t give them back.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDefined();
  });

  it('shows the same list on a member suspended by hand', async () => {
    await settings('/demo/settings/members?state=suspended');
    const block = screen.getByRole('heading', { name: 'Leads 3 events' }).closest('section');

    expect(
      within(block as HTMLElement).getByRole('button', { name: 'Hand over now' }),
    ).toBeDefined();
  });

  it('lets an admin read a suspended owner’s list, with no Hand over now', async () => {
    await settings('/demo/settings/members?as=julien&state=handoverReadOnly');
    const block = screen.getByRole('heading', { name: 'Leads 2 events' }).closest('section');

    expect(within(block as HTMLElement).queryByRole('button')).toBeNull();
    expect(
      screen.getByText('Only an owner can change an owner’s role or remove them.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove from Ire Events…' })).toBeNull();
  });

  it('starts Leave on Nobody, offers everyone else, and goes to Today', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = await settings('/demo/settings/general?state=leave&as=ana');
    const dialog = ask('Leave Ire Events?');

    expect(within(dialog).getByText('You lead 2 events. Hand them to:')).toBeDefined();
    expect(who().getAttribute('aria-label')).toBe('Hand them to: Nobody: the owners take them');
    fireEvent.click(who());
    expect(options().map((one) => one.textContent?.replace(/^[A-Z]{2}/u, ''))).toEqual([
      'Nobody: the owners take them',
      'Folake Adeyemi',
      'Julien Moreau',
      'Priya Shah',
      'Tom Becker',
      'Kofi Mensah',
    ]);
    fireEvent.click(options()[2] as Element);
    expect(who().getAttribute('aria-label')).toBe('Hand them to: Julien Moreau');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave Ire Events' }));
    expect(within(dialog).getByRole('button', { name: 'Leaving…' })).toBeDefined();
    await wait(600);

    expect(router.state.location.pathname).toBe('/demo/today');
  });

  it('keeps today’s Leave for a member who leads nothing, and says a failed one changed nothing', async () => {
    await settings('/demo/settings/general?state=leaveNoWork&as=ana');
    expect(
      within(ask('Leave Ire Events?')).getByText(
        'You lose access to Ire Events as soon as you leave.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Hand them to/u })).toBeNull();
  });

  it('says a failed Leave changed nothing', async () => {
    await settings('/demo/settings/general?state=leaveFailed&as=ana');

    expect(within(ask('Leave Ire Events?')).getByRole('alert').textContent).toBe(
      'Leaving did not work. Nothing was changed. Try again in a moment.',
    );
  });
});
