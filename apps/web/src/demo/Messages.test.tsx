import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/messages';

function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function messages(state: string | null) {
  const router = open(state == null ? AT : `${AT}?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);

  return router;
}

function list(): HTMLElement {
  return screen.getByRole('region', { name: 'Messages' });
}

function row(name: RegExp): HTMLElement {
  return within(list()).getByRole('link', { name });
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

function press(key: string, options: Partial<KeyboardEventInit> = {}): void {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, ...options });
}

async function seconds(count: number): Promise<void> {
  for (let second = 0; second < count; second += 1) await act(() => vi.advanceTimersByTime(1000));
}

describe('Messages in B · Conversations at a desk (sc-31371)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('links every state from the demo home, in a Messages group', SLOW, async () => {
    open('/demo');
    const group = (await screen.findByRole('heading', { level: 4, name: 'Messages' }, WAIT))
      .parentElement as HTMLElement;
    const links = within(group).getAllByRole('link');

    expect(links).toHaveLength(53);
    expect(links[0]?.getAttribute('href')).toBe(`${AT}?state=first`);
    expect(links[7]?.getAttribute('href')).toBe(`${AT}?state=noticeCost`);
    expect(links[26]?.getAttribute('href')).toBe(`${AT}?state=bell`);
    expect(links[52]?.getAttribute('href')).toBe(`${AT}?state=tellPlace`);
  });

  it('is the event’s own Messages entry, with the count under it', SLOW, async () => {
    const router = open('/demo/events/evt-wed-4');
    const side = await screen.findByRole('navigation', { name: 'Adaeze & Tunde’s wedding' }, WAIT);
    const entry = within(side).getByRole('link', { name: 'Messages, 3 waiting, 1 not matched' });

    expect(entry.textContent).toContain('3 waiting · 1 not matched');
    fireEvent.click(entry);

    expect(await screen.findByRole('heading', { level: 1, name: 'Messages' })).toBeDefined();
    expect(router.state.location.pathname).toBe(AT);
    expect(
      within(screen.getByRole('navigation', { name: 'Adaeze & Tunde’s wedding' })).getByRole(
        'link',
        { current: 'page' },
      ).textContent,
    ).toContain('Messages');
  });

  it(
    'sends ?area=messages to the Messages page, and keeps other events’ Messages coming',
    SLOW,
    async () => {
      const router = open('/demo/events/evt-wed-4?area=messages');

      await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
      expect(router.state.location.pathname).toBe(AT);
    },
  );

  it(
    'sorts the list into Needs you, Scheduled and Done, and waits with the composer',
    SLOW,
    async () => {
      await messages('inUse');

      expect(within(list()).getByRole('heading', { name: 'Needs you · 5' })).toBeDefined();
      expect(within(list()).getByRole('heading', { name: 'Scheduled · 1' })).toBeDefined();
      expect(within(list()).getByRole('heading', { name: 'Done' })).toBeDefined();
      expect(
        row(
          /^Inês Duarte, On their page · Can we bring our son\? Our sitter cancelled for Thursday\., 08:12$/,
        ),
      ).toBeDefined();
      expect(row(/^Parking at The Landmark, .*, Not reached · 11$/)).toBeDefined();
      expect(screen.getByText('Pick a conversation, or write to your guests below.')).toBeDefined();
      expect(screen.getByRole('button', { name: /All guests · 142/ })).toBeDefined();
    },
  );

  it('starts with no conversations, and the line says where the words go', SLOW, async () => {
    await messages('first');

    expect(screen.getByRole('heading', { name: 'No conversations yet' })).toBeDefined();
    expect(
      screen.getAllByText(
        'What you write appears on each guest’s own page. Each guest who answers gets a conversation here.',
      ),
    ).toHaveLength(2);
  });

  it('says Loading messages… once, as a status', SLOW, async () => {
    await messages('loading');

    expect(screen.getByText('Loading messages…').closest('[role=status]')).not.toBeNull();
  });

  it('opens a conversation on its heading, its row lit', SLOW, async () => {
    await messages('conversation');

    expect(row(/^Inês Duarte/).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('log', { name: 'Inês Duarte' })).toBeDefined();
    expect(
      screen.getByText('Your answer goes on Inês Duarte’s page. Soirely tells them by email.'),
    ).toBeDefined();

    fireEvent.click(row(/^Lucía Ortega/));

    expect(await screen.findByRole('heading', { level: 2, name: 'Lucía Ortega' })).toBe(
      document.activeElement,
    );
    expect(row(/^Lucía Ortega/).getAttribute('aria-current')).toBe('true');
    expect(
      screen.getByText('Your answer goes on Lucía Ortega’s page. Soirely tells them by WhatsApp.'),
    ).toBeDefined();
  });

  it(
    'Mark as done moves it to Done, says Done. and takes focus to the next row',
    SLOW,
    async () => {
      await messages('conversation');

      fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));

      expect(await screen.findByText('Done.', {}, WAIT)).toBeDefined();
      expect(within(list()).getByRole('heading', { name: 'Needs you · 4' })).toBeDefined();
      expect(row(/^Lucía Ortega/)).toBe(document.activeElement);
      expect(
        screen.getByText(
          'Done by Folake Adeyemi at 09:41. It comes back to Needs you if they write again.',
        ),
      ).toBeDefined();
      expect(
        screen.getByRole('link', { name: 'Messages, 2 waiting, 1 not matched' }),
      ).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Mark as waiting' }));

      expect(within(list()).getByRole('heading', { name: 'Needs you · 5' })).toBeDefined();
    },
  );

  it('puts an answer on their page, Sending… then Told by email', SLOW, async () => {
    await messages('conversation');
    const field = screen.getByRole('textbox', { name: 'Your answer' });

    fireEvent.change(field, { target: { value: 'Of course, bring him.' } });
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });

    const log = screen.getByRole('log', { name: 'Inês Duarte' });

    expect(within(log).getByText('Of course, bring him.')).toBeDefined();
    expect(within(log).getByText('Sending…')).toBeDefined();
    expect(await within(log).findByText('Not seen yet', {}, WAIT)).toBeDefined();
    expect(within(log).getAllByText('Told by email')).toHaveLength(2);
    expect(within(log).queryByText('Sending…')).toBeNull();
    expect((field as HTMLTextAreaElement).value).toBe('');
  });

  it('keeps a reply that came by SMS, with its answer typed', SLOW, async () => {
    await messages('channelReply');

    expect(
      screen.getByText(
        'This came by SMS, in answer to the text. Your answer goes on their page, and Soirely texts them that it is there.',
      ),
    ).toBeDefined();
    expect(
      (screen.getByRole('textbox', { name: 'Your answer' }) as HTMLTextAreaElement).value,
    ).toBe('Formal: suits and long dresses are welcome.');
  });

  it('says what a WhatsApp notice costs before Send, and takes it', SLOW, async () => {
    await messages('noticeCost');
    const field = screen.getByRole('textbox', { name: 'Your answer' }) as HTMLTextAreaElement;

    expect(field.value).toBe('Yes: free parking under the hotel, entrance on Calle Mayor.');
    expect(
      screen.getByText('Your answer goes on Lucía Ortega’s page. Soirely tells them by WhatsApp.'),
    ).toBeDefined();
    expect(
      screen.getByText('This WhatsApp message uses 4 credits. Credits after sending: 1,496.'),
    ).toBeDefined();

    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    const log = screen.getByRole('log', { name: 'Lucía Ortega' });

    expect(await within(log).findByText('Told by WhatsApp', {}, SLOW)).toBeDefined();
    expect(
      screen.getByText('This WhatsApp message uses 4 credits. Credits after sending: 1,492.'),
    ).toBeDefined();
  });

  it('shows no cost on an email notice', SLOW, async () => {
    await messages('conversation');

    expect(screen.queryByText(/credits?\. Credits after sending/)).toBeNull();
  });

  it('says the text’s cost on an SMS notice', SLOW, async () => {
    await messages('channelReply');

    expect(
      screen.getByText('This text uses 9 credits. Credits after sending: 1,491.'),
    ).toBeDefined();
  });

  it(
    'says a notice the credits won’t cover will wait, and holds it when sent anyway',
    SLOW,
    async () => {
      await messages('noticeWaits');

      expect(screen.getByText('1 WhatsApp message will wait for credits.')).toBeDefined();
      expect(screen.queryByText(/Credits after sending/)).toBeNull();
      expect(screen.getByRole('button', { name: 'Add credits' })).toBeDefined();
      expect(screen.getByText('Or tell them now by:')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Tell them now by email' })).toBeDefined();

      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Your answer' }), {
        key: 'Enter',
        metaKey: true,
      });
      const log = screen.getByRole('log', { name: 'Lucía Ortega' });

      expect(
        within(log).getByText('Yes: free parking under the hotel, entrance on Calle Mayor.'),
      ).toBeDefined();
      expect(
        await within(log).findByText('WhatsApp · Held: waiting for credits', {}, SLOW),
      ).toBeDefined();
    },
  );

  it('tells them by email instead when Email is chosen, at no cost', SLOW, async () => {
    await messages('noticeWaits');

    fireEvent.click(screen.getByRole('button', { name: 'Tell them now by email' }));

    expect(
      screen.getByText('Your answer goes on Lucía Ortega’s page. Soirely tells them by email.'),
    ).toBeDefined();
    expect(screen.queryByText('1 WhatsApp message will wait for credits.')).toBeNull();
    expect(screen.queryByText(/Credits after sending/)).toBeNull();
    const field = screen.getByRole('textbox', { name: 'Your answer' });

    expect(document.activeElement).toBe(field);
    fireEvent.keyDown(field, { key: 'Enter', metaKey: true });
    const log = screen.getByRole('log', { name: 'Lucía Ortega' });

    expect(await within(log).findByText('Told by email', {}, SLOW)).toBeDefined();
  });

  it('records a notice that waited and could not go as Not sent: too late', SLOW, async () => {
    await messages('noticeNotSent');
    const log = screen.getByRole('log', { name: 'Lucía Ortega' });

    expect(within(log).getByText('Sun, Nov 1')).toBeDefined();
    expect(within(log).getByText('Is there a vegetarian menu?')).toBeDefined();
    expect(within(log).getByText('WhatsApp · Not sent: too late')).toBeDefined();
    expect(within(log).getByText('Is there parking at The Landmark?')).toBeDefined();
    expect(screen.getByText('1 WhatsApp message will wait for credits.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Tell them now by SMS' })).toBeNull();
    expect(within(list()).getByRole('link', { name: /^Lucía Ortega/ })).toBeDefined();
  });

  it('puts a reply that arrives first, washed, and says it', SLOW, async () => {
    await messages('replyArrived');

    expect(within(list()).queryByRole('link', { name: /^Lucía Ortega/ })).toBeNull();
    expect(await screen.findByText('Lucía Ortega answered on their page.', {}, WAIT)).toBeDefined();
    expect(within(list()).getAllByRole('link')[0]?.getAttribute('aria-label')).toMatch(
      /^Lucía Ortega, .*, now$/,
    );
  });

  it(
    'moves with J and K, marks done with E, answers with R and writes with C, never from a field',
    SLOW,
    async () => {
      await messages('inUse');

      row(/^Inês Duarte/).focus();
      press('j');
      expect(row(/^Lucía Ortega/).getAttribute('aria-current')).toBe('true');
      expect(await screen.findByRole('heading', { level: 2, name: 'Lucía Ortega' })).toBeDefined();
      await vi.waitFor(() => expect(document.activeElement).toBe(row(/^Lucía Ortega/)));
      press('j');
      await vi.waitFor(() => expect(document.activeElement).toBe(row(/^Kwame Mensah/)));
      press('k');
      await vi.waitFor(() => expect(document.activeElement).toBe(row(/^Lucía Ortega/)));
      expect(row(/^Lucía Ortega/).getAttribute('aria-current')).toBe('true');

      press('e');
      expect(await screen.findByText('Done.', {}, WAIT)).toBeDefined();
      expect(within(list()).getByRole('heading', { name: 'Needs you · 4' })).toBeDefined();

      press('r');
      const answer = await screen.findByRole('textbox', { name: 'Your answer' });

      await vi.waitFor(() => expect(document.activeElement).toBe(answer));
      press('c');
      expect(screen.queryByRole('textbox', { name: 'Subject' })).toBeNull();

      screen.getByRole('heading', { level: 1, name: 'Messages' }).focus();
      press('c');
      expect(await screen.findByRole('textbox', { name: 'Subject' })).toBeDefined();
    },
  );

  it('turns the single keys off and on, saying so; ⌘ keys stay', SLOW, async () => {
    await messages('inUse');

    fireEvent.click(screen.getByRole('button', { name: 'Turn off single-key shortcuts' }));
    expect(
      screen.getByText('Single-key shortcuts are off.', { selector: 'p:not([role])' }),
    ).toBeDefined();

    row(/^Inês Duarte/).focus();
    press('j');
    expect(row(/^Inês Duarte/).getAttribute('aria-current')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'New' }).getAttribute('aria-keyshortcuts'),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Turn on single-key shortcuts' }));
    press('j');
    expect(row(/^Lucía Ortega/).getAttribute('aria-current')).toBe('true');
  });

  it(
    'picks who gets it: Guests who… counted, conditions removed and added, Escape back to To',
    SLOW,
    async () => {
      await messages('to');
      const to = screen.getByRole('dialog', { name: 'To' });

      expect(within(to).getByRole('radio', { name: 'Guests who…' })).toHaveProperty(
        'checked',
        true,
      );
      expect(within(to).getByText('96 guests')).toBeDefined();

      fireEvent.click(within(to).getByRole('button', { name: 'Remove condition: Is coming' }));
      expect(screen.getByRole('button', { name: /^Guests who…/ }).textContent).toBe('Guests who…');

      fireEvent.click(within(to).getByRole('button', { name: 'Add a condition' }));
      fireEvent.click(within(to).getByRole('button', { name: 'Hasn’t replied' }));
      expect(within(to).getByText('25 guests')).toBeDefined();

      fireEvent.click(within(to).getByRole('button', { name: 'Add a condition' }));
      fireEvent.click(within(to).getByRole('button', { name: 'Is coming' }));
      expect(within(to).getByText('Nobody matches')).toBeDefined();

      fireEvent.click(within(to).getByRole('radio', { name: /All guests/ }));
      press('Escape');

      const chip = screen.getByRole('button', { name: 'All guests · 142' });

      expect(screen.queryByRole('dialog', { name: 'To' })).toBeNull();
      await vi.waitFor(() => expect(document.activeElement).toBe(chip));
    },
  );

  it('refuses Guests who… with nobody, beside Send', SLOW, async () => {
    await messages('to');
    const to = screen.getByRole('dialog', { name: 'To' });

    fireEvent.click(within(to).getByRole('button', { name: 'Remove condition: Is coming' }));
    press('Escape');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Add a condition first. With none, Guests who… matches nobody, so there is nothing to send or save.',
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it(
    'opens the check in the conversation; Escape and Change it give the focus back to Send',
    SLOW,
    async () => {
      await messages('write');
      const body = screen.getByRole('textbox', { name: 'Message' });

      fireEvent.keyDown(body, { key: 'Enter', metaKey: true });

      const check = await screen.findByRole('alertdialog', { name: 'Check it before it goes' });

      await vi.waitFor(() =>
        expect(document.activeElement?.textContent).toBe('Sending to 96 people cannot be undone.'),
      );
      expect(
        within(check).getByText('2 can’t be told · it is on their page if they open it'),
      ).toBeDefined();
      expect(
        within(check).getByText('Texts use 31 credits. Credits after sending: 1,469.'),
      ).toBeDefined();

      press('Escape');
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send' })),
      );

      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Change it' }));
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send' })),
      );
    },
  );

  it(
    'counts ten seconds on the message, said at 10 and 5, and ⌘ Z puts the words back',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await messages('check');

      fireEvent.click(screen.getByRole('button', { name: 'Send to 96 people' }));
      expect(screen.getByText('Sending in 10…', { selector: '.mg-countdown-words' })).toBeDefined();
      expect(said()).toContain('Sending in 10…');
      expect(within(list()).getAllByRole('link')[0]?.getAttribute('aria-label')).toContain(
        'Sending in 10…',
      );

      await seconds(4);
      expect(screen.getByText('Sending in 6…', { selector: '.mg-countdown-words' })).toBeDefined();
      expect(said()).toContain('Sending in 10…');
      await seconds(1);
      expect(said()).toContain('Sending in 5…');

      press('z', { metaKey: true });

      expect(
        screen.getByText('Cancelled. Nothing was sent; your message is back in the box.'),
      ).toBeDefined();
      expect((screen.getByRole('textbox', { name: 'Subject' }) as HTMLInputElement).value).toBe(
        'Parking and the dress code',
      );
      expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toContain(
        'a few things before Thursday.',
      );
    },
  );

  it('after ten seconds says it is queued, once, then who it reached', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await messages('countdown');

    await seconds(10);
    expect(said()).toContain('Message queued. Sending to 96 people now.');
    expect(screen.getByText(/Reached 38 of 96 so far/, { selector: '.mg-sending' })).toBeDefined();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('textbox', { name: 'Write a follow-up' }),
      ),
    );

    await seconds(3);
    expect(said()).toContain('Reached 94 of 96');
    expect(screen.getByText('Reached 94 of 96 · seen by 3 on their page')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Who it reached' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Reached 38 of 96 so far' }),
    ).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'Everyone · 96' })).toBeDefined();
  });

  it('keeps the sent message and adds a follow-up after it', SLOW, async () => {
    await messages('sent');

    fireEvent.change(screen.getByRole('textbox', { name: 'Write a follow-up' }), {
      target: { value: 'One more thing.' },
    });

    const thread = await screen.findByRole('log', { name: 'Write a follow-up' });

    expect(within(thread).getByText('Parking and the dress code')).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toBe('One more thing.');

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send to 96 people' }));

    const log = await screen.findByRole('log', { name: 'Parking and the dress code' });

    expect(within(log).getByText('One more thing.')).toBeDefined();
    expect(
      within(log).getByText(
        'A follow-up goes to the same 96 guests, under the first message on their page.',
      ),
    ).toBeDefined();
    expect(within(list()).getAllByRole('link')[0]?.getAttribute('aria-label')).toMatch(
      /^Parking and the dress code, Follow-up · Sending in 10…/,
    );
  });

  it('names a message with no Subject by its first line, shortened', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await messages('inUse');

    fireEvent.change(screen.getByRole('textbox', { name: 'Write to your guests' }), {
      target: { value: 'Bring a coat, it will be cold by the river.' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Send to 142 people' }));

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Bring a coat, it will be cold by the…',
      }),
    ).toBeDefined();
    expect(row(/^Bring a coat, it will be cold by the…, Sending in 10…/)).toBeDefined();
  });

  it(
    'checks All guests with the board’s figures: nine can’t be told, two named',
    SLOW,
    async () => {
      await messages('checkAll');
      const check = screen.getByRole('alertdialog', { name: 'Check it before it goes' });

      expect(screen.getByRole('button', { name: 'All guests · 142' })).toBeDefined();
      expect(within(check).getByText('Sending to 142 people cannot be undone.')).toBeDefined();
      expect(
        within(check).getByText('9 can’t be told · it is on their page if they open it'),
      ).toBeDefined();
      expect(within(check).getByText('Sophie Laurent · Unsubscribed · Texted STOP')).toBeDefined();
      expect(within(check).getByRole('button', { name: 'See all 9' })).toBeDefined();
      expect(
        within(check).getByText('Texts use 39 credits. Credits after sending: 1,461.'),
      ).toBeDefined();
    },
  );

  it(
    'shows the message as their page shows it, and only Soirely’s notice by each channel',
    SLOW,
    async () => {
      await messages('preview');

      expect(screen.getByText('As Kwame Mensah will see it · English')).toBeDefined();
      const sends = screen.getByRole('region', { name: 'What Soirely sends' });

      expect(
        within(sends).getByText(/Adaeze Obi and Tunde Bakare sent you a message about/),
      ).toBeDefined();
      expect(within(sends).queryByText(/Marylebone Road/)).toBeNull();
      expect(screen.getByText(/^Kwame Mensah, a few things before Thursday/)).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(await screen.findByRole('textbox', { name: 'Message' })).toBeDefined();
    },
  );

  it('says a failed send as an alert, with the focus on Try again, which sends', SLOW, async () => {
    await messages('failed');

    expect(screen.getByRole('alert').textContent).toContain(
      'Nothing was sent. There is no connection; your message is still here.',
    );
    const again = screen.getByRole('button', { name: 'Try again' });

    await vi.waitFor(() => expect(document.activeElement).toBe(again));
    expect(row(/^Parking and the dress code, Nothing was sent, 09:41, Not sent$/)).toBeDefined();

    fireEvent.click(again);
    expect(
      await screen.findByText(/Reached 38 of 96 so far/, { selector: '.mg-sending' }),
    ).toBeDefined();
  });

  it('lists who it reached per person, grouped, and fixes an address in place', SLOW, async () => {
    await messages('reached');

    expect(screen.getByRole('heading', { level: 2, name: 'Reached 131 of 142' })).toBeDefined();
    for (const group of [
      'Bounced · 3',
      'Not confirmed · 2',
      'Opted out · 4',
      'No email or phone · 2',
    ])
      expect(screen.getByRole('region', { name: group })).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'Opted out · 4' })).getByText(
        'Fatima Zahra El Idrissi',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: 'Fix email address' })[0] as HTMLElement);

    const field = await screen.findByRole('textbox', { name: 'Email address' });

    expect((field as HTMLInputElement).value).toBe('tomas.ferreira@gmial.com');
    expect(screen.getByText('Was tomas.ferreira@gmial.com, which bounced.')).toBeDefined();

    fireEvent.change(field, { target: { value: 'tomas.ferreira' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();

    fireEvent.change(field, { target: { value: 'tomas.ferreira@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const again = await screen.findByRole('button', { name: 'Send to Tomás Ferreira again' });

    const tomas = within(screen.getByText('Tomás Ferreira').closest('li') as HTMLElement);

    expect(tomas.getByText('Email · Bounced')).toBeDefined();
    expect(tomas.getByText('Updated · not sent yet')).toBeDefined();
    expect(
      tomas.getByText('Their email address has changed since. Nothing has been sent to it yet.'),
    ).toBeDefined();
    expect(screen.queryByText('Email · Updated · not sent yet')).toBeNull();
    expect(screen.getByRole('region', { name: 'Bounced · 3' })).toBeDefined();
    await vi.waitFor(() => expect(document.activeElement).toBe(again));
    fireEvent.click(again);

    expect(await screen.findByRole('region', { name: 'In progress · 1' })).toBeDefined();
    expect(screen.getByText('Email · Sent · 09:44')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Resend to the 10 not reached' })).toBeDefined();
    expect(said()).toContain('Sent to Tomás Ferreira.');
  });

  it('counts a guest told in person as reached', SLOW, async () => {
    await messages('reached');

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Mark as told in person' })[0] as HTMLElement,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Reached 132 of 142' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: 'Not reached · 10' })).toBeDefined();
    expect(row(/^Parking at The Landmark, .*, Not reached · 10$/)).toBeDefined();
  });

  it('checks a resend first, then says it is queued', SLOW, async () => {
    await messages('resend');
    const check = screen.getByRole('alertdialog', { name: 'Check it before it goes' });

    expect(within(check).getByText('Sending to 3 people cannot be undone.')).toBeDefined();
    expect(within(check).getByText('Still can’t be told · 8')).toBeDefined();

    fireEvent.click(within(check).getByRole('button', { name: 'Send to 3 people' }));
    expect(await screen.findByText('Message queued. Sending to 3 people now.')).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('opens each of Who it reached’s states as it is named', SLOW, async () => {
    const opens: [string, () => HTMLElement][] = [
      ['addedPhone', () => screen.getByRole('button', { name: 'Send to Lars Johansson again' })],
      ['notNow', () => screen.getByText(/^Their email address has changed since/u)],
      ['told', () => screen.getByRole('region', { name: 'Marked as told · 1' })],
      ['filterMenu', () => screen.getByRole('menu', { name: 'Filter' })],
      ['filtered', () => screen.getByRole('heading', { level: 3, name: 'Bounced · 3' })],
      ['resendInvited', () => screen.getByText('None of the 2 can be told yet')],
      ['resendSent', () => screen.getByText('None of the 2 can be told yet')],
    ];

    for (const [state, shown] of opens) {
      await messages(state);
      expect(shown(), state).toBeDefined();
      cleanup();
      resetInbox();
    }
    await messages('notNow');
    expect(screen.queryByRole('button', { name: 'Send to Tomás Ferreira again' })).toBeNull();
  });

  it('adds an email address in place, then offers to send it, its line kept', SLOW, async () => {
    await messages('reached');
    const joaquin = () => within(screen.getByText('Joaquín Ruiz').closest('li') as HTMLElement);

    fireEvent.click(joaquin().getByRole('button', { name: 'Add an email address' }));
    const field = await screen.findByRole('textbox', { name: 'Email address' });

    expect((field as HTMLInputElement).value).toBe('');
    fireEvent.change(field, { target: { value: 'joaquin.ruiz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText('That does not look like an email address. Check it has an @ and a domain.'),
    ).toBeDefined();

    fireEvent.change(field, { target: { value: 'joaquin.ruiz@gmail.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const again = await screen.findByRole('button', { name: 'Send to Joaquín Ruiz again' });

    expect(joaquin().getByText('No email address')).toBeDefined();
    expect(joaquin().getByText('Updated · not sent yet')).toBeDefined();
    expect(
      joaquin().getByText(
        'An email address has been added since. Nothing has been sent to it yet.',
      ),
    ).toBeDefined();
    expect(joaquin().getByRole('button', { name: 'Not now' })).toBeDefined();
    await vi.waitFor(() => expect(document.activeElement).toBe(again));
  });

  it('adds a phone number, refusing one without the country code', SLOW, async () => {
    await messages('reached');
    const lars = () => within(screen.getByText('Lars Johansson').closest('li') as HTMLElement);

    fireEvent.click(lars().getByRole('button', { name: 'Add a phone number' }));
    const field = await screen.findByRole('textbox', { name: 'Mobile number' });

    expect(field.getAttribute('inputmode')).toBe('tel');
    fireEvent.change(field, { target: { value: '070 123 45 67' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      screen.getByText(
        'That does not look like a phone number. Start with + and the country code.',
      ),
    ).toBeDefined();

    fireEvent.change(field, { target: { value: '+46 70 123 45 67' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText(
        'A phone number has been added since. Nothing has been sent to it yet.',
      ),
    ).toBeDefined();
    expect(lars().getByText('SMS')).toBeDefined();
    expect(lars().getByRole('button', { name: 'Send to Lars Johansson again' })).toBeDefined();
  });

  it(
    'after Not now keeps the line, gives the other fixes back, and counts them in a resend',
    SLOW,
    async () => {
      await messages('added');
      const joaquin = () => within(screen.getByText('Joaquín Ruiz').closest('li') as HTMLElement);

      fireEvent.click(joaquin().getByRole('button', { name: 'Not now' }));

      expect(screen.queryByRole('button', { name: 'Send to Joaquín Ruiz again' })).toBeNull();
      expect(joaquin().getByText('Updated · not sent yet')).toBeDefined();
      expect(joaquin().queryByRole('button', { name: 'Add an email address' })).toBeNull();
      expect(joaquin().getByRole('button', { name: 'Add a phone number' })).toBeDefined();
      expect(joaquin().getByRole('button', { name: 'Mark as told in person' })).toBeDefined();
      expect(screen.getByRole('region', { name: 'No email or phone · 2' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Resend to the 11 not reached' }));
      const check = await screen.findByRole('alertdialog', { name: 'Check it before it goes' });

      expect(within(check).getByText('Sending to 4 people cannot be undone.')).toBeDefined();
      expect(within(check).getByText('Still can’t be told · 7')).toBeDefined();
    },
  );

  it('sends an added address again: Sent on its line, In progress, and says so', SLOW, async () => {
    await messages('added');

    fireEvent.click(screen.getByRole('button', { name: 'Send to Joaquín Ruiz again' }));

    const progress = await screen.findByRole('region', { name: 'In progress · 1' });

    expect(within(progress).getByText('Joaquín Ruiz')).toBeDefined();
    expect(within(progress).getByText('Email · Sent · 09:44')).toBeDefined();
    expect(within(progress).getByText(/joaquin\.ruiz@gmail\.com/u)).toBeDefined();
    expect(within(progress).queryByText('Updated · not sent yet')).toBeNull();
    expect(screen.getByRole('region', { name: 'No email or phone · 1' })).toBeDefined();
    expect(said()).toContain('Sent to Joaquín Ruiz.');
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(within(progress).getByText('Joaquín Ruiz')),
    );
  });

  it(
    'marks a guest as told in person, lists them as Marked as told, and Undo puts them back',
    SLOW,
    async () => {
      await messages('reached');
      const amaka = () => within(screen.getByText('Amaka Eze').closest('li') as HTMLElement);

      fireEvent.click(amaka().getByRole('button', { name: 'Mark as told in person' }));

      expect(screen.getByRole('heading', { level: 2, name: 'Reached 132 of 142' })).toBeDefined();
      expect(screen.queryByText('Amaka Eze')).toBeNull();
      expect(said()).toContain('Amaka Eze is marked as told in person.');

      fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Marked as told · 1' }));

      const told = screen.getByRole('region', { name: 'Marked as told · 1' });

      expect(screen.getByRole('heading', { level: 3, name: 'Marked as told · 1' })).toBeDefined();
      expect(within(told).getByText('Told in person')).toBeDefined();
      expect(within(told).getByText(/Marked by Folake Adeyemi at 09:44/u)).toBeDefined();

      fireEvent.click(within(told).getByRole('button', { name: 'Undo' }));
      expect(screen.getByRole('heading', { level: 2, name: 'Reached 131 of 142' })).toBeDefined();
      expect(said()).toContain('Amaka Eze is no longer marked as told.');

      fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Not reached · 11' }));
      expect(
        within(screen.getByRole('region', { name: 'Not confirmed · 2' })).getByText('Amaka Eze'),
      ).toBeDefined();
      expect(amaka().getByText('SMS · Sent')).toBeDefined();
    },
  );

  it(
    'filters by group from a menu that the keys move through and Escape closes',
    SLOW,
    async () => {
      await messages('reached');
      const filter = screen.getByRole('button', { name: 'Filter' });

      fireEvent.click(filter);
      const menu = screen.getByRole('menu', { name: 'Filter' });
      const items = within(menu).getAllByRole('menuitemradio');

      expect(items.map((item) => item.getAttribute('aria-label'))).toEqual([
        'Everyone · 142',
        'Not reached · 11',
        'Bounced · 3',
        'Not confirmed · 2',
        'Opted out · 4',
        'No email or phone · 2',
        'Reached · 131',
        'Marked as told · 0',
      ]);
      expect(items[1]?.getAttribute('aria-checked')).toBe('true');
      expect(document.activeElement).toBe(items[1]);
      press('ArrowDown');
      expect(document.activeElement).toBe(items[2]);
      press('Escape');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(filter);

      fireEvent.click(filter);
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Bounced · 3' }));

      expect(screen.getByRole('heading', { level: 3, name: 'Bounced · 3' })).toBeDefined();
      expect(screen.getByRole('region', { name: 'Bounced · 3' })).toBeDefined();
      expect(screen.queryByRole('region', { name: 'Opted out · 4' })).toBeNull();
      expect(screen.queryByText('Amaka Eze')).toBeNull();

      fireEvent.click(filter);
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Reached · 131' }));
      const all = screen.getByRole('region', { name: 'Reached · 131' });

      expect(within(all).getByText('Inês Duarte')).toBeDefined();
      expect(within(all).getByText('Kwame Mensah')).toBeDefined();
      expect(
        within(all).getByText('and 129 more, filling in as their deliveries come back'),
      ).toBeDefined();
    },
  );

  it('says nobody is marked as told yet, and shows the not reached again', SLOW, async () => {
    await messages('reached');

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Marked as told · 0' }));
    expect(screen.getByText('Nobody is marked as told yet.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Show not reached' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Not reached · 11' })).toBeDefined();
    expect(screen.getByRole('region', { name: 'Bounced · 3' })).toBeDefined();
  });

  it('checks a resend of an invitation with nobody to tell yet, and goes back', SLOW, async () => {
    await messages('invitedReached');

    fireEvent.click(screen.getByRole('button', { name: 'Resend to the 2 not reached' }));
    const check = await screen.findByRole('alertdialog', { name: 'Check it before it goes' });

    expect(within(check).getByText('None of the 2 can be told yet')).toBeDefined();
    expect(
      within(check).getByText(
        'Add an email address or a phone number first, or mark them as told in person.',
      ),
    ).toBeDefined();
    expect(within(check).getByText('Still can’t be told · 2')).toBeDefined();
    expect(
      within(check).getByText('Mei Lin Chen · No email address · No phone number'),
    ).toBeDefined();
    expect(within(check).queryByRole('button', { name: /^Send to/u })).toBeNull();
    expect(within(check).queryByText(/credit/u)).toBeNull();

    fireEvent.click(within(check).getByRole('button', { name: 'Back to Who it reached' }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Reached 140 of 142' }),
    ).toBeDefined();
  });

  it(
    'checks a resend of a message just sent with nobody to tell yet, and goes back',
    SLOW,
    async () => {
      await messages('sentReached');

      fireEvent.click(screen.getByRole('button', { name: 'Resend to the 2 not reached' }));
      const check = await screen.findByRole('alertdialog', { name: 'Check it before it goes' });

      expect(within(check).getByText('None of the 2 can be told yet')).toBeDefined();
      expect(
        within(check).getByText('Tomás Ferreira · Address is bouncing · No phone number'),
      ).toBeDefined();

      fireEvent.click(within(check).getByRole('button', { name: 'Back to Who it reached' }));
      expect(
        await screen.findByRole('heading', { level: 2, name: 'Reached 38 of 96 so far' }),
      ).toBeDefined();
    },
  );

  it(
    'tells guests over Overview; Not now leaves the banner on Messages, and Dismiss takes it away',
    SLOW,
    async () => {
      open(`${AT}?state=tell`);
      const dialog = await screen.findByRole('dialog', { name: 'Tell 130 guests?' }, WAIT);

      expect(within(dialog).getByText('The start time is now 17:30 (was 18:00).')).toBeDefined();
      expect(within(dialog).getByText('Note for your guests')).toBeDefined();
      expect(
        within(dialog).getByText(
          'Shown on each guest’s page, under the change. Never sent by email, text or WhatsApp.',
        ),
      ).toBeDefined();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Not now' }));

      fireEvent.click(screen.getByRole('link', { name: 'Messages, 3 waiting, 1 not matched' }));
      const banner = await screen.findByRole('region', { name: 'Guests have not been told yet' });

      expect(within(banner).getByText('New start time')).toBeDefined();
      fireEvent.click(within(banner).getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByRole('region', { name: 'Guests have not been told yet' })).toBeNull();
    },
  );

  it('edits, sends now and cancels a scheduled message, asking first', SLOW, async () => {
    await messages('scheduled');

    expect(
      screen.getByText(
        'Goes Thu, Nov 5, 09:00 London time. Who gets it and the credits are worked out again when it goes.',
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(
      screen.getByText('Editing. It still goes Thu, Nov 5 at 09:00 unless you change when.'),
    ).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), {
      target: { value: 'On the day: the doors' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved.', {}, WAIT)).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'On the day: the doors' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    expect(
      screen.getByText('It was scheduled for Thu, Nov 5 at 09:00. It goes now instead.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it scheduled' }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel…' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Cancel “On the day: the doors”?' });

    await vi.waitFor(() =>
      expect(document.activeElement).toBe(within(ask).getByRole('button', { name: 'Keep it' })),
    );
    press('Escape');
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel message' }));
    expect(
      screen.getByText('Cancelled by Folake Adeyemi at 09:46. It was not sent.'),
    ).toBeDefined();
    expect(within(list()).queryByRole('heading', { name: /^Scheduled/ })).toBeNull();
    expect(
      row(/^On the day: the doors, Cancelled by Folake Adeyemi at 09:46, 09:46, Cancelled$/),
    ).toBeDefined();
  });

  it('matches a sender Soirely could not match to a guest, then answers them', SLOW, async () => {
    await messages('notMatched');

    expect(
      screen.getByText(
        'Soirely could not match m.dubois@orange.fr to a guest. Choose the guest to answer them.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('textbox', { name: 'Your answer' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Choose the guest' }));
    const picker = await screen.findByRole('dialog', { name: 'Who is this?' });
    const search = within(picker).getByRole('searchbox', { name: 'Search guests' });

    await vi.waitFor(() => expect(document.activeElement).toBe(search));
    fireEvent.change(search, { target: { value: 'claude' } });
    expect(within(picker).getAllByRole('radio')).toHaveLength(1);
    fireEvent.change(search, { target: { value: 'Dubois' } });
    expect(within(picker).getAllByRole('radio')).toHaveLength(3);
    fireEvent.click(within(picker).getByRole('button', { name: 'This is Camille Dubois' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Camille Dubois' })).toBeDefined();
    expect(await screen.findByText('Matched to Camille Dubois.', {}, WAIT)).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Messages, 4 waiting' })).toBeDefined();
  });

  it('opens Tell guests when Overview’s start time is saved', SLOW, async () => {
    open('/demo/events/evt-wed-4?state=dates');
    const start = await screen.findByLabelText('Starts, Time', {}, WAIT);

    fireEvent.change(start, { target: { value: '17:30' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0] as HTMLElement);

    const dialog = await screen.findByRole('dialog', { name: 'Tell 130 guests?' });

    expect(within(dialog).getByText('The start time is now 17:30 (was 18:00).')).toBeDefined();
  });

  it('opens the bell with the batched replies and a message that missed people', SLOW, async () => {
    await messages('bell');
    const bell = screen.getByRole('dialog', { name: 'Notifications' });

    expect(within(bell).getByText('3 coming, 1 not coming, 1 changed their reply')).toBeDefined();
    fireEvent.click(within(bell).getByRole('button', { name: 'Mark all read' }));
    expect(within(bell).queryByText('Unread')).toBeNull();

    fireEvent.click(within(bell).getByRole('button', { name: /11 people didn’t get it/ }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Reached 131 of 142' }),
    ).toBeDefined();
  });

  it(
    'shows invitations as Soirely’s own card, its reach and who is now Invited',
    SLOW,
    async () => {
      await messages('invited');

      expect(
        screen.getByText(
          'Adaeze & Tunde’s wedding: an invitation from Adaeze Obi and Tunde Bakare',
        ),
      ).toBeDefined();
      expect(screen.getByText('Reached 140 of 142 · seen by 121 on their page')).toBeDefined();
      expect(screen.getByText('140 guests are now Invited, by Soirely’s message.')).toBeDefined();
    },
  );

  it('sends nothing to the API', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetched = vi.spyOn(globalThis, 'fetch');

    await messages('check');
    fireEvent.click(screen.getByRole('button', { name: 'Send to 96 people' }));
    await seconds(14);

    expect(fetched).not.toHaveBeenCalled();
    fetched.mockRestore();
  });

  it(
    'schedules for later, refusing a time too soon, never with a disabled Schedule',
    SLOW,
    async () => {
      await messages('later');
      const when = await screen.findByRole('dialog', { name: 'When it goes' });

      await vi.waitFor(() =>
        expect(document.activeElement).toBe(within(when).getByRole('radio', { name: 'Later' })),
      );
      fireEvent.change(within(when).getByLabelText('Date'), { target: { value: '2026-11-03' } });
      fireEvent.change(within(when).getByLabelText('Time'), { target: { value: '09:42' } });
      fireEvent.click(within(when).getByRole('button', { name: 'Schedule' }));

      expect(within(when).getByRole('alert').textContent).toContain(
        'At least 5 minutes from now, and before the event ends on Sat, Nov 7 at 15:00.',
      );
      expect(within(when).getByLabelText('Time').getAttribute('aria-invalid')).toBe('true');

      fireEvent.change(within(when).getByLabelText('Date'), { target: { value: '2026-11-05' } });
      fireEvent.change(within(when).getByLabelText('Time'), { target: { value: '09:00' } });
      fireEvent.click(within(when).getByRole('button', { name: 'Schedule' }));

      expect(await screen.findByText('Scheduled for Thu, Nov 5 at 09:00.', {}, WAIT)).toBeDefined();
      expect(within(list()).getByRole('heading', { name: 'Scheduled · 2' })).toBeDefined();
    },
  );

  it('counts the check again in place when SMS is unticked in it', SLOW, async () => {
    await messages('check');
    const check = screen.getByRole('alertdialog', { name: 'Check it before it goes' });

    fireEvent.click(within(check).getByRole('checkbox', { name: 'SMS' }));

    expect(within(check).getByText('SMS is off, so 2 more can’t be told.')).toBeDefined();
    expect(
      within(check).getByText('4 can’t be told · it is on their page if they open it'),
    ).toBeDefined();
    expect(within(check).getByText('Amaka Eze · No email address · SMS is off')).toBeDefined();
    expect(within(check).getByText('Email uses no credits.')).toBeDefined();
  });

  it('checks Hasn’t replied with its own figures', SLOW, async () => {
    await messages('checkNotReplied');
    const check = screen.getByRole('alertdialog', { name: 'Check it before it goes' });

    expect(screen.getByRole('button', { name: 'Guests who… Hasn’t replied · 25' })).toBeDefined();
    expect(within(check).getByText('Sending to 25 people cannot be undone.')).toBeDefined();
    expect(
      within(check).getByText('Mei Lin Chen · No email address · No phone number'),
    ).toBeDefined();
    expect(
      within(check).getByText('Texts use 9 credits. Credits after sending: 1,491.'),
    ).toBeDefined();
  });

  it(
    'shows who an invitation reached, and who a message just sent reached so far',
    SLOW,
    async () => {
      await messages('invitedReached');

      expect(screen.getByRole('heading', { level: 2, name: 'Reached 140 of 142' })).toBeDefined();
      expect(
        screen.getByText('140 now Invited · seen by 121 on their page · 2 no email or phone'),
      ).toBeDefined();
      expect(screen.getAllByRole('button', { name: 'Copy their link' })).toHaveLength(2);
      fireEvent.click(screen.getByRole('button', { name: 'Invitation' }));
      expect(await screen.findByRole('heading', { level: 2, name: 'Invitation' })).toBeDefined();
    },
  );

  it('tells guests a new place, with the address line, over Overview', SLOW, async () => {
    open(`${AT}?state=tellPlace`);
    const dialog = await screen.findByRole('dialog', { name: 'Tell 130 guests?' }, WAIT);

    expect(
      within(dialog).getByText('The venue is now Rosewood London (was The Landmark).'),
    ).toBeDefined();
    expect(
      within(dialog).getByText('The email adds the new address, with Open in maps.'),
    ).toBeDefined();
  });

  it(
    'marks the Subject Optional, as the boards draw it, and says so once it is typed',
    SLOW,
    async () => {
      await messages('inUse');

      fireEvent.click(screen.getByRole('button', { name: 'New' }));

      const subject = await screen.findByRole('textbox', { name: 'Subject' });
      const optional = () =>
        document.getElementById(subject.getAttribute('aria-describedby') ?? '');

      expect(optional()?.textContent).toBe('Optional');
      expect(optional()?.className).toBe('mg-optional');
      expect(optional()?.parentElement?.className).toBe('mg-subject-hint');

      fireEvent.change(subject, { target: { value: 'Parking' } });
      expect(optional()?.textContent).toBe('Optional');
      expect(optional()?.parentElement?.className).toBe('desk-unseen');
    },
  );
});
