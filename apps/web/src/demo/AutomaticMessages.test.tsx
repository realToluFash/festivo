import { fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
afterEach(() => __setConfig(tested));

async function open(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/automatic-messages?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, { timeout: 8000 });
}

const toggle = (name: string) => screen.getByRole('switch', { name });

describe('/demo/automatic-messages (sc-3974)', () => {
  it('lists both messages on, each with its next date and count, and one footer', async () => {
    await open('live');
    expect(toggle('Reminders to answer').getAttribute('aria-checked')).toBe('true');
    expect(toggle('Before you come').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('Next on Friday, Dec 4, to 63 guests as things stand.')).toBeTruthy();
    expect(screen.getByText('Next on Friday, Dec 18, to 12 guests as things stand.')).toBeTruthy();
    expect(screen.getAllByText(/same channels as their invitation/)).toHaveLength(1);
  });

  it('asks before turning off with sends waiting, and Keep it on leaves it on', async () => {
    await open('live');
    fireEvent.click(toggle('Reminders to answer'));
    const asked = screen.getByRole('dialog', { name: 'Turn off reminders to answer?' });
    expect(within(asked).getByText('The 129 messages waiting to go are cancelled.')).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Keep it on');
    fireEvent.click(within(asked).getByRole('button', { name: 'Keep it on' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle('Reminders to answer').getAttribute('aria-checked')).toBe('true');
  });

  it('turns off on Turn off, hides the next line, and brings it back when switched on', async () => {
    await open('live');
    fireEvent.click(toggle('Reminders to answer'));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Turn off' }));
    expect(toggle('Reminders to answer').getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByText(/Next on Friday, Dec 4/)).toBeNull();
    expect(screen.getByText('Reminders to answer is off.')).toBeTruthy();
    fireEvent.click(toggle('Reminders to answer'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Next on Friday, Dec 4, to 63 guests as things stand.')).toBeTruthy();
  });

  it('turns off at once with nothing waiting', async () => {
    await open('nextNone');
    expect(screen.getByText('Next on Friday, Dec 4, to nobody as things stand.')).toBeTruthy();
    fireEvent.click(toggle('Reminders to answer'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(toggle('Reminders to answer').getAttribute('aria-checked')).toBe('false');
  });

  it('keeps both off in a draft with one reason, and publishing switches them on', async () => {
    await open('draft');
    expect(
      screen.getAllByText(
        'These are off while the event is a draft, and turn on when you publish it.',
      ),
    ).toHaveLength(1);
    fireEvent.click(toggle('Reminders to answer'));
    expect(toggle('Reminders to answer').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: 'Publish the event' }));
    expect(toggle('Reminders to answer').getAttribute('aria-checked')).toBe('true');
    expect(screen.queryByText(/while the event is a draft/)).toBeNull();
  });

  it('skips the 7-day reminder when published 4 days before replies close', async () => {
    await open('publishLate');
    fireEvent.click(screen.getByRole('button', { name: 'Publish the event' }));
    expect(screen.getByText('Next on Tuesday, Dec 8, to 3 guests as things stand.')).toBeTruthy();
  });

  it('keeps Reminders to answer on without a reply-by date while the Not sure yet ask is ahead', async () => {
    await open('noReplyBy');
    expect(toggle('Reminders to answer').getAttribute('aria-disabled')).not.toBe('true');
    expect(screen.getByText('Next on Saturday, Dec 5, to 3 guests as things stand.')).toBeTruthy();
  });

  it('shows Reminders to answer unavailable once neither date is set and the 14-days ask has passed, with the way to set one', async () => {
    await open('unavailable');
    expect(toggle('Reminders to answer').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('link', { name: 'Set a reply-by date to use this.' })).toBeTruthy();
  });

  it('opens each confirm as a state', async () => {
    await open('confirmBeforeOne');
    const asked = screen.getByRole('dialog', { name: 'Turn off Before you come?' });
    expect(within(asked).getByText('1 guest who is coming will not get it.')).toBeTruthy();
  });

  it('loads with bones, busy', async () => {
    await open('loading');
    expect(screen.getByText('Loading automatic messages')).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
