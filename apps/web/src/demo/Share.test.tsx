import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { MOST_WRONG, PASSPHRASE, SHARE_PAGES } from './share.ts';

const tested = config();
const SLOW = { timeout: 15000 };
const SHARE = '/demo/events/evt-wed-4?area=budget&state=';
const plain = window.matchMedia;

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

function rows(): HTMLElement[] {
  return screen.getAllByRole('listitem').filter((one) => one.classList.contains('share-row'));
}

function row(title: string): HTMLElement {
  const found = rows().find((one) => one.textContent?.startsWith(title));
  if (found == null) throw new Error(`No link ${title}`);

  return found;
}

function form(): HTMLElement {
  return screen.getByRole('region', { name: 'Create a link' });
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
});

afterEach(() => {
  __setConfig(tested);
  window.matchMedia = plain;
  vi.restoreAllMocks();
});

describe('Share at a desk (sc-94, Budget-A-Share)', () => {
  it(
    'lists the links under Budget, Live or Ended in words, Revoke only on a live one',
    SLOW,
    async () => {
      await open(`${SHARE}links`);

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Share');
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toContain(
        'Budget',
      );
      expect(
        screen.getByText(
          'It never shows your costs behind client prices or your margin. While any line has a client price, it shows no payments either.',
        ),
      ).toBeDefined();
      expect(
        rows().map((one) => within(one).queryByRole('button', { name: 'Revoke' }) != null),
      ).toEqual([true, true, true, false]);
      expect(row('Flowers').textContent).toContain('Ended');
      expect(row('The whole budget').textContent).toContain('Live');
      expect(row('Mr and Mrs Obi’s share').textContent).toContain('Made by Folake Adeyemi');
    },
  );

  it('says No links yet beside Create a link, never an empty table', SLOW, async () => {
    await open(`${SHARE}no_links`);

    expect(screen.getByText('No links yet.')).toBeDefined();
    expect(
      screen.queryAllByRole('listitem').filter((one) => one.classList.contains('share-row')),
    ).toHaveLength(0);
    expect(within(form()).getByRole('button', { name: 'Create a link' })).toBeDefined();
  });

  it(
    'creates Aunt Funmi’s share: Link created, the link, and the new row lit at the top',
    SLOW,
    async () => {
      await open(`${SHARE}links`);
      fireEvent.click(within(form()).getByRole('button', { name: 'Create a link' }));

      const made = await screen.findByRole('region', { name: 'Link created' });
      expect(document.activeElement?.textContent).toBe('Link created');
      expect(made.textContent).toContain(
        'Aunt Funmi’s share. It shows the latest each time it is opened.',
      );
      expect((within(made).getByLabelText('The link') as HTMLInputElement).value).toMatch(
        /^https:\/\/soirely\.com\/s\/Q7v4[\w-]{18}$/u,
      );
      expect(rows()[0]?.textContent).toContain('Aunt Funmi’s share');
      expect(rows()[0]?.textContent).toContain('Not opened yet');

      fireEvent.click(within(made).getByRole('button', { name: 'Done' }));
      expect(document.activeElement).toBe(rows()[0]);
      expect(within(form()).getByRole('heading', { name: 'Create a link' })).toBeDefined();
    },
  );

  it(
    'refuses one category with none chosen at the field, then creates it once chosen',
    SLOW,
    async () => {
      await open(`${SHARE}links`);
      fireEvent.click(within(form()).getByRole('radio', { name: 'One category' }));
      fireEvent.click(within(form()).getByRole('button', { name: 'Create a link' }));

      const category = within(form()).getByRole('combobox', { name: 'Category' });
      expect(category.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(category);
      expect(
        document.getElementById(category.getAttribute('aria-describedby') ?? '')?.textContent,
      ).toBe('Choose a category.');
      expect(screen.queryByRole('region', { name: 'Link created' })).toBeNull();

      fireEvent.change(category, { target: { value: 'flowers' } });
      expect(within(form()).queryByText('Choose a category.')).toBeNull();
      fireEvent.click(within(form()).getByRole('button', { name: 'Create a link' }));
      expect((await screen.findByRole('region', { name: 'Link created' })).textContent).toContain(
        'Flowers. It shows the latest each time it is opened.',
      );
    },
  );

  it(
    'refuses a past end date and a short or long passphrase, deep-linked, and takes the fix',
    SLOW,
    async () => {
      await open(`${SHARE}past_date`);
      const ends = within(form()).getByLabelText('Ends on · Optional');
      expect(ends.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(ends);
      expect(within(form()).getByText('Choose a date after today.')).toBeDefined();
      fireEvent.change(ends, { target: { value: '2026-11-10' } });
      fireEvent.click(within(form()).getByRole('button', { name: 'Create a link' }));
      await screen.findByRole('region', { name: 'Link created' });
      expect(rows()[0]?.textContent).toContain('Ends Tue, Nov 10');
    },
  );

  it('names the passphrase limits at the field, and asks it once made', SLOW, async () => {
    await open(`${SHARE}short_passphrase`);
    const phrase = within(form()).getByLabelText('Passphrase · Optional');
    expect(
      within(form()).getByText(
        'Make the passphrase at least 8 characters long, or leave it empty.',
      ),
    ).toBeDefined();
    expect(document.activeElement).toBe(phrase);
    fireEvent.change(phrase, { target: { value: 'x'.repeat(65) } });
    fireEvent.click(within(form()).getByRole('button', { name: 'Create a link' }));
    expect(
      within(form()).getByText('Shorten the passphrase to 64 characters or fewer.'),
    ).toBeDefined();
    fireEvent.change(phrase, { target: { value: 'tunde-and-adaeze' } });
    fireEvent.click(within(form()).getByRole('button', { name: 'Create a link' }));
    await screen.findByRole('region', { name: 'Link created' });
    expect(rows()[0]?.textContent).toContain('Asks for a passphrase');
  });

  it('asks Revoke once in the row, Keep first, then ends the link at once', SLOW, async () => {
    await open(`${SHARE}revoke`);
    const ask = screen.getByRole('group', {
      name: 'Revoke Mr and Mrs Bakare’s share? Anyone holding it sees nothing from now on.',
    });
    expect(document.activeElement?.textContent).toBe('Keep');

    fireEvent.click(within(ask).getByRole('button', { name: 'Keep' }));
    const revoke = within(row('Mr and Mrs Bakare’s share')).getByRole('button', { name: 'Revoke' });
    expect(document.activeElement).toBe(revoke);

    fireEvent.click(revoke);
    const again = screen.getByRole('group', { name: /^Revoke Mr and Mrs Bakare/u });
    fireEvent.click(within(again).getByRole('button', { name: 'Revoke' }));
    const bakare = row('Mr and Mrs Bakare’s share');
    expect(bakare.textContent).toContain('Ended');
    expect(within(bakare).queryByRole('button', { name: 'Revoke' })).toBeNull();
    expect(document.activeElement).toBe(bakare);
  });

  it('copies the link as a status, or selects it with the copyRefused line', SLOW, async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('no'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await open(`${SHARE}created`);
    const made = screen.getByRole('region', { name: 'Link created' });

    await act(async () => {
      fireEvent.click(within(made).getByRole('button', { name: 'Copy the link' }));
    });
    expect(within(made).getByRole('status').textContent).toBe('Link copied. Paste it into a chat.');

    await act(async () => {
      fireEvent.click(within(made).getByRole('button', { name: 'Copy the link' }));
    });
    expect(within(made).getByRole('status').textContent).toBe(
      'Could not copy here. The link is selected: press Ctrl+C or Command+C.',
    );
    expect(document.activeElement).toBe(within(made).getByLabelText('The link'));
  });
});

describe('the share a link opens, signed out (sc-94, sc-1300)', () => {
  it(
    'opens a payer’s share on the event’s cover, with no navigation and no sign-in',
    SLOW,
    async () => {
      await open('/demo/share/payer?state=payer');

      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
        'Your share of Adaeze & Tunde’s wedding',
      );
      const page = screen.getByRole('main');
      expect(page.textContent).toContain('Mr and Mrs Obi');
      expect(page.textContent).toContain('Shared by Ire Events · Updated Tue, Nov 3 at 09:41');
      expect(page.textContent).toContain('£10,620 to £12,285');
      expect(screen.getByRole('heading', { level: 2, name: 'What it covers' })).toBeDefined();
      expect(screen.queryByRole('navigation')).toBeNull();
      expect(screen.queryByText(/sign in/iu)).toBeNull();
      expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
        'noindex, nofollow',
      );
    },
  );

  it('prints from Print', SLOW, async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    await open('/demo/share/whole?state=whole');
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));

    expect(print).toHaveBeenCalledOnce();
  });

  it('leaves payments out of a marked-up event entirely', SLOW, async () => {
    await open('/demo/share/whole?state=marked_up');
    const page = screen.getByRole('main').textContent ?? '';

    expect(page).toContain('£25,296 to £29,292');
    expect(page).not.toMatch(/Paid|Still to pay|Next:/u);
  });

  it(
    'asks the passphrase, refuses a wrong one at the field, and opens on the right one',
    SLOW,
    async () => {
      await open('/demo/share/whole?state=passphrase');
      const field = screen.getByLabelText('Passphrase');
      expect(document.activeElement).toBe(field);
      expect(screen.getByRole('main').textContent).not.toContain('£');

      fireEvent.change(field, { target: { value: 'marigolds' } });
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByRole('alert').textContent).toBe(
        'That passphrase is not right. Check it and try again.',
      );
      expect(field.getAttribute('aria-invalid')).toBe('true');

      fireEvent.change(field, { target: { value: PASSPHRASE } });
      fireEvent.submit(field.closest('form') as HTMLFormElement);
      const h1 = await screen.findByRole('heading', {
        level: 1,
        name: 'The budget for Adaeze & Tunde’s wedding',
      });
      expect(document.activeElement).toBe(h1);
    },
  );

  it('locks after 10 wrong passphrases, the right one refused too', SLOW, async () => {
    await open('/demo/share/whole?state=wrong_passphrase');
    const field = screen.getByLabelText('Passphrase');
    const tooMany = 'Too many wrong passphrases have been tried on this link. Try again at 14:47.';

    for (let tried = 1; tried < MOST_WRONG; tried += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'That passphrase is not right. Check it and try again.',
    );

    fireEvent.change(field, { target: { value: PASSPHRASE } });
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('alert').textContent).toBe(tooMany);
  });

  it('says one thing for a link that opens nothing', SLOW, async () => {
    await open('/demo/share/whole?state=gone');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'This link does not open anything',
    );
    expect(
      screen.getByText(
        'It may have been revoked or have ended. Ask the person who sent it for a new one.',
      ),
    ).toBeDefined();
  });

  it('lays out as the guest’s page: two columns from 1024, one below', SLOW, async () => {
    window.matchMedia = (query: string) =>
      ({
        matches: /width >= /u.test(query),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as never;
    await open('/demo/share/whole?state=whole');

    expect(document.querySelector('.sh')?.className).toContain('is-desk');
    expect(screen.getByRole('main').className).toContain('is-two');
  });

  it('is linked from the demo home under its own heading', SLOW, async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo'] });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 3, name: /^Share links/u }, SLOW);
    const hrefs = screen.getAllByRole('link').map((one) => one.getAttribute('href'));

    for (const state of SHARE_PAGES.flatMap((page) => page.states))
      expect(hrefs).toContain(state.to);
  });
});
