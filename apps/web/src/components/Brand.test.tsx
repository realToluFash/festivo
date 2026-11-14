import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import lockupUrl from '../brand/lockup.svg';
import wordmarkUrl from '../brand/wordmark.svg';
import { Brand } from './Brand.tsx';

describe('Brand', () => {
  it('is read as the name Soirely, once, and never as an image', () => {
    const { container } = render(<Brand />);

    expect(container.textContent).toBe('Soirely');
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows the lockup only wider than 40rem, and the wordmark up to it', () => {
    const { container } = render(<Brand lockup />);

    expect(container.querySelector('source')?.getAttribute('media')).toBe('(width > 40rem)');
    expect(container.querySelector('source')?.getAttribute('srcset')).toBe(lockupUrl);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(wordmarkUrl);
    expect(container.textContent).toBe('Soirely');
  });
});
