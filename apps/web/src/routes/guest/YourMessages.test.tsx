import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

const ORG = 'The Okafors';

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status < 400 ? 'application/json' : 'application/problem+json' },
  });
}

function standing(
  email: [boolean, boolean] = [true, true],
  texts: [boolean, boolean] = [true, true],
  whatsApp: [boolean, boolean] = [true, true],
) {
  const of = ([onRecord, on]: [boolean, boolean]) => ({ onRecord, on });

  return {
    organisation: ORG,
    channels: { email: of(email), texts: of(texts), whatsApp: of(whatsApp) },
  };
}

function open(replies: (() => Response)[], at = '/your-messages#tok_ada'): string[] {
  const asked: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    asked.push(
      `${init?.method ?? 'GET'} ${new URL(String(input)).pathname} ${String(init?.body ?? '')}`,
    );

    return (replies.shift() ?? (() => answer({}, 500)))();
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);

  return asked;
}

function offline(): Response {
  throw new TypeError('offline');
}

describe('Your messages (sc-3969)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('from an email’s link, opening it changes nothing and leads with Stop emails', async () => {
    const asked = open([() => answer(standing())]);

    expect(await screen.findByRole('button', { name: `Stop emails from ${ORG}` })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Your messages' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    expect(screen.getAllByRole('switch')).toHaveLength(3);
    expect(asked).toEqual(['POST /api/your-messages {"token":"tok_ada"}']);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'noindex',
    );
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe(
      'no-referrer',
    );
  });

  it('one tap stops emails, shows the words with Undo, and Undo turns them on again', async () => {
    const asked = open([
      () => answer(standing()),
      () => answer(standing([true, false])),
      () => answer(standing()),
    ]);

    fireEvent.click(await screen.findByRole('button', { name: `Stop emails from ${ORG}` }));

    const words = await screen.findByText(`You won’t get emails from ${ORG} any more.`);
    expect(document.activeElement).toBe(words);
    expect(asked[1]).toBe(
      'PUT /api/your-messages {"token":"tok_ada","channel":"email","on":false}',
    );
    expect(
      screen.getByRole('switch', { name: 'Email' }).getAttribute('aria-checked') ??
        (screen.getByRole('switch', { name: 'Email' }) as HTMLInputElement).checked,
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(await screen.findByText(`Emails from ${ORG} are on again.`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(asked[2]).toBe('PUT /api/your-messages {"token":"tok_ada","channel":"email","on":true}');
  });

  it('keeps the button’s words while it saves, and a failed save shows nothing as made', async () => {
    const asked = open([() => answer(standing()), offline, () => answer(standing([true, false]))]);

    const button = await screen.findByRole('button', { name: `Stop emails from ${ORG}` });
    fireEvent.click(button);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toBe('Saving…');

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Saving did not work. Nothing has changed.Try again',
    );
    expect(screen.queryByText(`You won’t get emails from ${ORG} any more.`)).toBeNull();
    expect(screen.getByRole('button', { name: `Stop emails from ${ORG}` })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText(`You won’t get emails from ${ORG} any more.`)).toBeTruthy();
    expect(asked[2]).toBe(asked[1]);
  });

  it('opened while emails are already off shows Email off and no button', async () => {
    open([() => answer(standing([true, false]))]);

    const email = (await screen.findByRole('switch', { name: 'Email' })) as HTMLInputElement;
    expect(email.checked).toBe(false);
    expect(screen.queryByRole('button', { name: `Stop emails from ${ORG}` })).toBeNull();
  });

  it('a switch saves at once, says so under its name, and goes back when the save fails', async () => {
    const asked = open([
      () => answer(standing()),
      () => answer(standing([true, true], [true, false])),
      offline,
    ]);

    fireEvent.click(await screen.findByRole('switch', { name: 'Text messages' }));

    await waitFor(() =>
      expect(document.getElementById('gp-texts-saved')?.textContent).toBe(
        `Texts from ${ORG} are off.`,
      ),
    );
    expect(asked[1]).toBe(
      'PUT /api/your-messages {"token":"tok_ada","channel":"texts","on":false}',
    );

    const whatsApp = screen.getByRole('switch', { name: 'WhatsApp' }) as HTMLInputElement;
    fireEvent.click(whatsApp);

    expect(await screen.findByText('Saving did not work. Nothing has changed.')).toBeTruthy();
    expect(whatsApp.checked).toBe(true);
    expect(document.getElementById('gp-texts-saved')).toBeTruthy();
  });

  it('a channel with nothing on record has no switch and says so', async () => {
    open([() => answer(standing([false, false], [false, false], [false, false]))]);

    expect(await screen.findByText(`${ORG} has no email address for you.`)).toBeTruthy();
    expect(screen.getAllByText(`${ORG} has no phone number for you.`)).toHaveLength(2);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: `Stop emails from ${ORG}` })).toBeNull();
  });

  it('a tampered or unknown link says it does not work and offers nothing', async () => {
    open([() => answer({ type: 'about:blank', title: 'Not found', status: 404 }, 404)]);

    expect(await screen.findByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull();
  });

  it('a failed first load offers Try again instead of loading for good', async () => {
    open([() => answer({}, 500), () => answer(standing())]);

    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('button', { name: `Stop emails from ${ORG}` })).toBeTruthy();
  });

  it('with no token at all, says the link does not work without asking', async () => {
    const asked = open([], '/your-messages');

    expect(await screen.findByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    expect(asked).toEqual([]);
  });

  it('from the guest’s page, sends the guest’s token, shows the switches alone and Back', async () => {
    const asked = open([() => answer(standing())], '/i/guest_token_abcdefghij/messages');

    expect(await screen.findByRole('link', { name: 'Back' })).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole('switch')).toHaveLength(3));
    expect(screen.queryByRole('button', { name: `Stop emails from ${ORG}` })).toBeNull();
    expect(asked).toEqual(['POST /api/your-messages {"guestToken":"guest_token_abcdefghij"}']);
  });
});
