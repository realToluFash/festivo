import { act, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useFocusOnceShown } from './stepFocus.ts';
import { cssRule } from './test-styles.ts';

function Card() {
  const [stage, setStage] = useState<'open' | 'loading' | 'at-rest'>('open');
  const land = useFocusOnceShown();

  return (
    <>
      {stage === 'open' && (
        <button
          type="button"
          onClick={() => {
            setStage('loading');
            land(() => document.getElementById('opener'));
          }}
        >
          Cancel
        </button>
      )}
      {stage === 'loading' && (
        <button type="button" onClick={() => setStage('at-rest')}>
          Loaded
        </button>
      )}
      {stage === 'at-rest' && (
        <button type="button" id="opener">
          Turn on
        </button>
      )}
    </>
  );
}

describe('useFocusOnceShown', () => {
  it('waits through a render without the target, then focuses it once it shows', () => {
    render(<Card />);

    act(() => screen.getByRole('button', { name: 'Cancel' }).click());
    expect(document.activeElement).toBe(document.body);

    act(() => screen.getByRole('button', { name: 'Loaded' }).click());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Turn on' }));
  });
});

describe('where focus lands for a notice (sc-74701)', () => {
  it('keeps 12px clear of its scroller on both edges, so its focus ring shows whole', () => {
    expect(cssRule('[data-notice-landing]')).toContain('scroll-margin-block: var(--spaceLg);');
  });

  it("rings a page heading it lands on, over that page's own :focus { outline: none }", () => {
    const ring = cssRule('[data-notice-landing]:focus');

    expect(ring).toContain('outline: 2px solid var(--colorAccent) !important;');
    expect(ring).toContain('outline-offset: 2px !important;');
  });
});
