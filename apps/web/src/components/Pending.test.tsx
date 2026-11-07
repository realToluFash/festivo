import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';

import '../i18n/index.ts';
import { PendingPage } from './Pending.tsx';

afterEach(() => {
  vi.useRealTimers();
});

it('keeps the header at once and says Loading only after 400 ms (sc-29065)', async () => {
  vi.useFakeTimers();
  render(
    <MemoryRouter>
      <PendingPage />
    </MemoryRouter>,
  );

  expect(screen.getByRole('banner')).toBeDefined();
  expect(screen.queryByText('Loading…')).toBeNull();

  await act(() => vi.advanceTimersByTimeAsync(399));
  expect(screen.queryByText('Loading…')).toBeNull();

  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByText('Loading…')).toBeDefined();
});
