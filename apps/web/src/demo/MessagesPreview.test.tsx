import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
const ONLY_OURS =
  'Only Soirely’s own words are translated. Yours show on their page exactly as you wrote them.';
const BRACES = '[Braces you type stay as typed. To fill something in for each guest, use Insert.]';
const NOTHING = 'Nothing to fill in, so every guest gets exactly these words.';

async function messages(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function lines(): string[] {
  return [...document.querySelectorAll('.mg-preview-lines li')].map((one) => one.textContent ?? '');
}

function page(): string {
  return document.querySelector('.mg-page-figure blockquote')?.textContent ?? '';
}

describe('Write it once at a desk: Insert, Preview as and its lines (sc-3960)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'opens Insert as a menu of the four tokens, each with its line, the first focused',
    SLOW,
    async () => {
      await messages('insert');
      const menu = screen.getByRole('menu', { name: 'Insert' });
      const items = within(menu).getAllByRole('menuitem');

      expect(screen.getByRole('button', { name: 'Insert' }).getAttribute('aria-expanded')).toBe(
        'true',
      );
      expect(items.map((one) => one.getAttribute('aria-label'))).toEqual([
        'Greeting',
        'Event',
        'Date',
        'Hosts',
      ]);
      expect(
        items.map(
          (one) => document.getElementById(one.getAttribute('aria-describedby') ?? '')?.textContent,
        ),
      ).toEqual([
        'Their Greet as, or their full name if they have none',
        'The event’s name',
        'The event’s day, or its days',
        'The event’s hosts',
      ]);
      await vi.waitFor(() => expect(document.activeElement).toBe(items[0]));

      fireEvent.keyDown(items[0] as HTMLElement, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(items[3]);
      fireEvent.keyDown(items[3] as HTMLElement, { key: 'Escape' });
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Insert' }));
    },
  );

  it('puts a picked token in the field, the caret just after it', SLOW, async () => {
    await messages('insert');
    const field = screen.getByRole('textbox', { name: 'Message' });

    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Date' }));

    const chip = within(field).getByRole('img', { name: 'Date, filled in for each guest' });

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(field);
    const caret = window.getSelection()?.getRangeAt(0);

    expect(caret?.collapsed).toBe(true);
    expect(caret?.startContainer).toBe(field);
    expect(caret?.startOffset).toBe([...field.childNodes].indexOf(chip) + 1);
  });

  it(
    'opens Preview as on the five people in To, A to Z, each with their language',
    SLOW,
    async () => {
      await messages('previewAs');
      const button = screen.getByRole('button', { name: 'Preview as Kwame Mensah · English' });
      const list = screen.getByRole('listbox', { name: 'Preview as' });
      const options = within(list).getAllByRole('option');

      expect(button.getAttribute('aria-expanded')).toBe('true');
      expect(options.map((one) => one.textContent)).toEqual([
        'Bisi Adewale · English',
        'Camille Dubois · French',
        'Kemi Bankole · English',
        'Kwame Mensah · English',
        'Lucía Ortega · Spanish',
      ]);
      await vi.waitFor(() => expect(document.activeElement).toBe(options[3]));
      expect(options[3]?.getAttribute('aria-selected')).toBe('true');
    },
  );

  it('says it is filling it in, then shows the page for the guest chosen', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await messages('previewAs');
    const options = within(screen.getByRole('listbox')).getAllByRole('option');

    fireEvent.keyDown(options[3] as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[4]);
    fireEvent.keyDown(options[4] as HTMLElement, { key: 'Enter' });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(
      screen.getByText('Filling it in for Lucía Ortega…', { selector: '[role=status]' }),
    ).toBeDefined();
    expect(document.querySelector('.mg-page-figure')).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Preview as Lucía Ortega · Spanish' }),
    );

    await act(() => vi.advanceTimersByTime(1000));

    expect(screen.getByRole('heading', { name: 'As Lucía Ortega will see it' })).toBeDefined();
    expect(page()).toMatch(/^Lucía Ortega, a few things before Thursday\./u);
    expect(lines()).toEqual([
      'Greeted as Lucía Ortega, their full name. They have no Greet as.',
      'In Spanish, the language you set for them.',
      ONLY_OURS,
    ]);
  });

  it('greets Bisi Adewale by her Greet as, in the organisation’s language', SLOW, async () => {
    await messages('previewGreetAs');

    expect(screen.getByRole('heading', { name: 'As Bisi Adewale will see it' })).toBeDefined();
    expect(page()).toMatch(/^Auntie Bisi, a few things before Thursday\./u);
    expect(screen.getByText(/^Dear Auntie Bisi,/u)).toBeDefined();
    expect(lines()).toEqual([
      'Greeted as “Auntie Bisi”, their Greet as.',
      'In English, your organisation’s language, as no language is set for them.',
      ONLY_OURS,
    ]);
    expect(screen.queryByText(/Yours go out exactly/u)).toBeNull();
  });

  it(
    'shows Camille Dubois the Date in French and Soirely’s words as French stand-ins',
    SLOW,
    async () => {
      await messages('previewChose');
      const sends = screen.getByRole('region', { name: 'What Soirely sends' });

      expect(page()).toBe(
        'Camille Dubois, a few things before [jeudi 5 nov.]. Parking is on Marylebone Road, and the dress code is formal. If anything changes for you, answer here.',
      );
      expect(screen.getByText('[jeu. 5 nov.] · 18:00 · The Landmark')).toBeDefined();
      expect(
        within(sends).getByText(
          '[Adaeze & Tunde’s wedding : un message de Adaeze Obi et Tunde Bakare]',
        ),
      ).toBeDefined();
      expect(
        within(sends).getByText('[Le lire sur votre page]').closest('[lang]')?.getAttribute('lang'),
      ).toBe('fr');
      expect(lines()).toEqual([
        'Greeted as Camille Dubois, their full name. They have no Greet as.',
        'In French, the language they chose on their page.',
        ONLY_OURS,
      ]);
    },
  );

  it('fills it in for Camille Dubois over Sunk shapes, said as a status', SLOW, async () => {
    await messages('previewLoading');

    expect(screen.getByRole('heading', { name: 'As Camille Dubois will see it' })).toBeDefined();
    expect(
      screen.getByText('Filling it in for Camille Dubois…', { selector: '[role=status]' }),
    ).toBeDefined();
    expect(document.querySelector('.mg-preview-bones')?.getAttribute('aria-hidden')).toBe('true');
    expect(document.querySelector('.mg-page-figure')).toBeNull();
  });

  it('shows a Greet as with markup as text, never as markup', SLOW, async () => {
    await messages('previewMarkup');

    expect(page()).toMatch(/^Kemi "KB" <Bankole> & Co, a few things/u);
    expect(document.querySelector('bankole')).toBeNull();
    expect(screen.getByText('Dear Kemi "KB" <Bankole> & Co,', { exact: false })).toBeDefined();
    expect(lines().slice(0, 2)).toEqual([
      'Greeted as “Kemi "KB" <Bankole> & Co”, their Greet as.',
      'In English, the language you set for them.',
    ]);
  });

  it('keeps a typed {Greeting} as text beside an inserted Greeting', SLOW, async () => {
    await messages('typedBraces');
    const field = screen.getByRole('textbox', { name: 'Message' });

    expect(
      within(field).getAllByRole('img', { name: 'Greeting, filled in for each guest' }),
    ).toHaveLength(1);
    expect(field.textContent).toContain('formal. {Greeting}, if anything changes for you');
    await vi.waitFor(() => expect(document.activeElement).toBe(field));
  });

  it('previews typed braces as typed, and says so', SLOW, async () => {
    await messages('previewBraces');

    expect(page()).toBe(
      'Kwame Mensah, a few things before Thursday. Parking is on Marylebone Road, and the dress code is formal. {Greeting}, if anything changes for you, answer here.',
    );
    expect(lines()).toEqual([
      'Greeted as Kwame Mensah, their full name. They have no Greet as.',
      'In English, the language you set for them.',
      ONLY_OURS,
      BRACES,
    ]);
  });

  it('says there is nothing to fill in, with no Greeted line', SLOW, async () => {
    await messages('noTokens');

    expect(page()).toMatch(/^A few things before Thursday\./u);
    expect(lines()).toEqual(['In English, the language you set for them.', ONLY_OURS, NOTHING]);
  });

  it('offers no Preview with nobody in To, and says why beside it', SLOW, async () => {
    await messages('previewNobody');
    const preview = screen.getByRole('button', { name: 'Preview' });
    const why = document.getElementById(preview.getAttribute('aria-describedby') ?? '');

    expect(preview.getAttribute('aria-disabled')).toBe('true');
    expect(why?.textContent).toBe('No guests chosen yet, so there is nobody to preview it as.');
    await vi.waitFor(() => expect(document.activeElement).toBe(preview));

    fireEvent.click(preview);
    expect(screen.queryByRole('heading', { name: /will see it$/u })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDefined();
  });
});
