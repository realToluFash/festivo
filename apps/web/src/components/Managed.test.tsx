import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ManagedBanner } from './Managed.tsx';

const MANAGED = {
  organisation: { name: 'Ìrè Events' },
  message: 'Your ire.events address is managed by Ìrè Events, so you can only be a member there.',
};

describe('the managed banner (sc-563)', () => {
  it('offers changing the main email address', () => {
    render(
      <MemoryRouter>
        <ManagedBanner managed={MANAGED} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Change your main email address' })).toBeDefined();
  });

  it('leaves the link out on A few details, behind the onboarding gate', () => {
    render(
      <MemoryRouter>
        <ManagedBanner managed={MANAGED} level={3} way={false} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Managed by Ìrè Events' })).toBeDefined();
    expect(screen.getByText('Access to a single event still works.')).toBeDefined();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
