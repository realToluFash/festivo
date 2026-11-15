import { cleanup, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 15000 };

async function messages(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/messages?state=${state}`],
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

describe('answers in one tap in WhatsApp, at a desk (sc-46343)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => cleanup());

  it('previews the invitation with three answers in the guest’s language', SLOW, async () => {
    await messages('invitePreviewAnswersFr');

    const card = screen.getByText('Oui, je serai là').closest('.mi-wa');

    if (!(card instanceof HTMLElement)) throw new Error('no template card');
    expect(within(card).getByText('Hélas, je ne pourrai pas')).toBeTruthy();
    expect(within(card).getByText('Je ne sais pas encore')).toBeTruthy();
    expect(within(card).queryByText('Répondre sur votre page')).toBeNull();
  });

  it('keeps the one-button card while the answers are paused', SLOW, async () => {
    await messages('invitePreviewAnswersPaused');

    const card = screen.getByText('Reply on your page').closest('.mi-wa');

    if (!(card instanceof HTMLElement)) throw new Error('no template card');
    expect(within(card).queryByText('Yes, I’ll be there')).toBeNull();
  });

  it('draws the line after Done, then Soirely’s message with its receipt', SLOW, async () => {
    await messages('tapNotComing');

    const log = screen.getByRole('log', { name: 'Kwame Mensah' });
    const items = within(log).getAllByRole('listitem');
    const done = items.findIndex((one) => /^Done by Folake Adeyemi/u.test(one.textContent ?? ''));
    const line = items.findIndex((one) =>
      (one.textContent ?? '').includes('Kwame Mensah answered Not coming by WhatsApp. · 08:20'),
    );

    expect(done).toBeGreaterThan(-1);
    expect(line).toBeGreaterThan(done);
    expect(within(log).getByText('Your companions won’t be coming either.')).toBeTruthy();
    expect(within(log).getByText('WhatsApp · Read')).toBeTruthy();
  });

  it('says why nothing went to a guest who stopped WhatsApp', SLOW, async () => {
    await messages('tapStopped');

    const log = screen.getByRole('log', { name: 'Lucía Ortega' });

    expect(within(log).getByText('Not sent · Stopped WhatsApp')).toBeTruthy();
    expect(within(log).queryByText(/Gracias/u)).toBeNull();
  });

  it('answers a Coming guest’s tap without recording it', SLOW, async () => {
    await messages('tapComing');

    const log = screen.getByRole('log', { name: 'Kwame Mensah' });

    expect(
      within(log).getByText(/Kwame Mensah tapped Not coming in WhatsApp\. Nothing changed\./u),
    ).toBeTruthy();
    expect(within(log).getByText(/^You’re down as Coming/u)).toBeTruthy();
  });

  it(
    'opens a first conversation with the invitation, then the tap, and no question',
    SLOW,
    async () => {
      await messages('tapFirst');

      const log = screen.getByRole('log', { name: 'Valentina Restrepo' });

      expect(within(log).getByText('Invitation')).toBeTruthy();
      expect(
        within(log).getByText(/Valentina Restrepo answered Not coming by WhatsApp\. · 08:20/u),
      ).toBeTruthy();
      expect(within(log).getByText(/^Gracias\. Hemos avisado/u)).toBeTruthy();
      expect(within(log).queryByText(/shuttle/u)).toBeNull();
      expect(within(log).queryByText(/^Done by/u)).toBeNull();
    },
  );
});
