import type { PausedOrganisation } from '@soirely/api-client';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { membership } from '../test-memberships.ts';
import { AccessPaused } from './AccessPaused.tsx';

function paused(reason: PausedOrganisation['suspension']['reason']): PausedOrganisation {
  const { id, name, countryCode, currency, timezone, contactAddress, locale } = membership({
    id: 'org_1',
    name: 'Ìrè Events',
  });

  return {
    id,
    name,
    countryCode,
    currency,
    timezone,
    contactAddress,
    locale,
    suspension: {
      reason,
      domain: 'ire.events',
      since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday, Oct 16 at 09:40 WAT' },
      removesAt: { at: '2026-11-15T08:40:00+00:00', written: 'Sunday, Nov 15 at 09:40 WAT' },
    },
  };
}

describe('AccessPaused', () => {
  it('says the address went, when it is removed, and how to get back in', () => {
    const onSwitch = vi.fn();
    const other = membership({ id: 'org_2', name: 'Okafor Family' });
    render(
      <MemoryRouter>
        <AccessPaused
          paused={paused('address_gone')}
          others={[other]}
          onSwitch={onSwitch}
          onChoose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Your access to Ìrè Events is paused because your ire.events address is no longer on your account.',
      }),
    ).toBeDefined();
    expect(screen.getByText('Paused since Friday, Oct 16 at 09:40 WAT.')).toBeDefined();
    expect(
      screen.getByText(
        'If nobody restores your access by Sunday, Nov 15 at 09:40 WAT, you are removed from Ìrè Events.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: 'Account settings' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Switch organisation' }));
    expect(onSwitch).toHaveBeenCalledWith(other);
  });

  it('opens the switcher when there are two or more other organisations', () => {
    const onSwitch = vi.fn();
    const onChoose = vi.fn();
    render(
      <MemoryRouter>
        <AccessPaused
          paused={paused('address_gone')}
          others={[
            membership({ id: 'org_2', name: 'Okafor Family' }),
            membership({ id: 'org_3', name: 'Lagos Weddings' }),
          ]}
          onSwitch={onSwitch}
          onChoose={onChoose}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Switch organisation' }));
    expect(onChoose).toHaveBeenCalledOnce();
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('asks nothing of the person when the organisation closed the domain', () => {
    render(
      <MemoryRouter>
        <AccessPaused
          paused={paused('domain_closed')}
          others={[]}
          onSwitch={vi.fn()}
          onChoose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Your access to Ìrè Events is paused because Ìrè Events no longer lets people join through ire.events.',
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'An admin of Ìrè Events can restore your access. Nothing is needed from you.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Account settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Switch organisation' })).toBeNull();
  });

  it('names no removal for the only owner, who is never removed', () => {
    const owner = paused('address_gone');
    render(
      <MemoryRouter>
        <AccessPaused
          paused={{ ...owner, suspension: { ...owner.suspension, removesAt: null } }}
          others={[]}
          onSwitch={vi.fn()}
          onChoose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Paused since Friday, Oct 16 at 09:40 WAT.')).toBeDefined();
    expect(screen.queryByText(/you are removed from/)).toBeNull();
  });

  it('names another organisation managing the domain', () => {
    render(
      <MemoryRouter>
        <AccessPaused
          paused={paused('domain_managed_elsewhere')}
          others={[]}
          onSwitch={vi.fn()}
          onChoose={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        name: 'Your access to Ìrè Events is paused because ire.events is now managed by another organisation.',
      }),
    ).toBeDefined();
  });
});
