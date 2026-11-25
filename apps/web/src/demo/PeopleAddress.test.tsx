import { cleanup, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { LONG_ADDRESSES } from './people.ts';
import { addressSides } from '../components/wholeAddress.ts';
import { readAddressesInline } from '../components/wholeAddressTesting.ts';

const tested = config();

readAddressesInline();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => {
  cleanup();
  __setConfig(tested);
});

async function people(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/people?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'People' });
}

describe('an outsider’s address breaks after its @, never inside its domain (sc-91529)', () => {
  it('cuts each side before its dots and keeps the @ on the side before it', () => {
    expect(addressSides('amaka.outside@soirely.test')).toEqual({
      local: ['amaka', '.outsid'],
      at: 'e@',
      domain: ['soirely', '.test'],
    });
    expect(addressSides(LONG_ADDRESSES.addressUnbroken)?.local).toEqual([
      'fundacaocomunitariadeoyoeartescontemporanea',
    ]);
    expect(addressSides('a@soirely.test')).toEqual({
      local: [],
      at: 'a@',
      domain: ['soirely', '.test'],
    });
    expect(addressSides('+234 803 123 4567')).toBeNull();
    expect(addressSides('Ada Obiageli Chukwuemeka Oluwaseun Obi')).toBeNull();
  });

  it.each(Object.entries(LONG_ADDRESSES))(
    '%s reads the address as typed in the dialog and the row, with nothing put in',
    async (state, address) => {
      await people(state);

      const role = within(screen.getByRole('dialog', { name: 'Role on this event' }));
      const shown = role.getByText((_, node) => node?.className === 'whole-address');
      expect(shown.textContent).toBe(address);
      expect(shown.querySelectorAll('wbr').length).toBeGreaterThan(0);
      expect(shown.querySelector('.whole-address-domain')?.textContent).toBe('soirely.test');
      expect(shown.querySelector('.whole-address-at')?.textContent).toMatch(/^[a-z]@$/u);
      expect(
        screen.getByRole('button', {
          hidden: true,
          name: new RegExp(`^${address.replaceAll('.', '\\.')}`, 'u'),
        }),
      ).toBeDefined();
    },
  );

  it('opens the Remove ask for the unbroken address', async () => {
    await people('addressRemove');

    expect(
      screen.getByRole('alertdialog', {
        name: `Remove ${LONG_ADDRESSES.addressUnbroken} from this event?`,
      }),
    ).toBeDefined();
  });

  it('leaves a mobile number and a joined name as they are', async () => {
    await people('addressShort');

    expect(
      screen.getByRole('button', { hidden: true, name: /^\+234 803 123 4567/u }),
    ).toBeDefined();
    expect(document.querySelectorAll('.whole-address')).toHaveLength(2);
  });
});
