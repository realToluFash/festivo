import { act, render, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { focusWhenFree, useDeskDialog } from './layers.ts';

function Ask() {
  const box = useRef<HTMLDivElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  useDeskDialog(box, keep, () => {});

  return (
    <div ref={box} role="alertdialog" tabIndex={-1}>
      <button ref={keep} type="button">
        Keep
      </button>
    </div>
  );
}

function Page({ asking }: { asking: boolean }) {
  return (
    <main className="desk-main">
      <h1 tabIndex={-1}>Seating</h1>
      <svg>
        <g role="button" tabIndex={0} aria-label="Table 1" />
      </svg>
      {asking && <Ask />}
    </main>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('useDeskDialog', () => {
  it('gives focus back to an SVG opener once the dialog closes', async () => {
    const page = render(<Page asking={false} />);
    const item = page.getByRole('button', { name: 'Table 1' });
    item.focus();

    page.rerender(<Page asking />);
    expect(document.activeElement).toBe(page.getByRole('button', { name: 'Keep' }));

    act(() => page.rerender(<Page asking={false} />));
    await waitFor(() => expect(document.activeElement).toBe(item));
  });
});

describe('focusWhenFree', () => {
  it('waits for the closing layer to lift the page’s inert before it focuses', async () => {
    // jsdom focuses inside an `[inert]` subtree; a browser does not.
    const focus = HTMLElement.prototype.focus;
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
      this: HTMLElement,
      options?: FocusOptions,
    ) {
      if (this.closest('[inert]') == null) focus.call(this, options);
    });
    const page = render(<Page asking={false} />);
    const main = page.container.querySelector('main') as HTMLElement;
    const heading = page.getByRole('heading', { name: 'Seating' });
    main.setAttribute('inert', '');

    focusWhenFree(() => heading);
    await new Promise((done) => window.setTimeout(done, 0));
    await new Promise((done) => window.requestAnimationFrame(done));
    expect(document.activeElement).toBe(document.body);

    main.removeAttribute('inert');
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });
});
