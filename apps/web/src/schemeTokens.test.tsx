import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { EventCoverImage } from './routes/app/events/EventCoverImage.tsx';
import { readSchemeBlocks, schemeTokens } from './schemeTokens.ts';

afterEach(() => {
  delete document.documentElement.dataset.scheme;
});

describe('a scheme’s tokens, read from tokens.css', () => {
  it('reads each block, the base and every scheme', () => {
    const { base, schemes } = readSchemeBlocks(
      ":root {\n  --colorAccent: #111111;\n  --colorPage: #222222;\n}\n:root[data-scheme='garden'] {\n  --colorAccent: #333333;\n}\n",
    );

    expect(base.get('--colorPage')).toBe('#222222');
    expect(schemes.get('garden')?.get('--colorAccent')).toBe('#333333');
  });

  it('gives each scheme its own accent and page', () => {
    expect(schemeTokens('citrus').get('--colorAccent')).toBe('#C2410C');
    expect(schemeTokens('garden').get('--colorPage')).toBe('#FFFDF8');
  });
});

describe('an event’s cover', () => {
  it('keeps its own colours whatever scheme the person picked', () => {
    document.documentElement.dataset.scheme = 'garden';

    render(<EventCoverImage photo={null} type="birthday" sizes="" />);
    const cover = screen.getByTestId('cover-default');

    expect(cover.style.getPropertyValue('--colorAccent')).toBe(
      schemeTokens('violet').get('--colorAccent'),
    );
    expect(cover.style.getPropertyValue('--colorAccentTint')).toBe(
      schemeTokens('violet').get('--colorAccentTint'),
    );
  });
});
