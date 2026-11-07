import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary.tsx';

function Broken(): never {
  throw new Error('broken');
}

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('offers Try again as a house button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    const retry = screen.getByRole('button', { name: 'Try again' });

    expect(retry.classList.contains('button')).toBe(true);
  });
});
