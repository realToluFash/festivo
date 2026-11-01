import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { cssRule } from '../test-styles.ts';
import { BackControl } from './BackControl.tsx';

const SOURCE = join(import.meta.dirname, '..');

describe('BackControl', () => {
  it('reads ‹ Events, is heard as Events, and goes where it points', async () => {
    const router = createMemoryRouter(
      [
        { path: '/app/events/new', element: <BackControl label="Events" to="/app/events" /> },
        { path: '/app/events', element: <h1>Events list</h1> },
      ],
      { initialEntries: ['/app/events/new'] },
    );
    render(<RouterProvider router={router} />);

    const back = screen.getByRole('link', { name: 'Events' });
    expect(back.textContent).toBe('‹Events');
    expect(back.className).toBe('link-button back-control');
    fireEvent.click(back);

    expect(await screen.findByRole('heading', { name: 'Events list' })).toBeDefined();
  });

  it('is a button heard by its title when it has no place to go', () => {
    const onClick = vi.fn();
    render(<BackControl className="members-back" label="Members" onClick={onClick} />);

    const back = screen.getByRole('button', { name: 'Members' });
    expect(back.className).toBe('link-button back-control members-back');
    fireEvent.click(back);

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('keeps its ‹ apart from the title, at least 44px tall and never underlined', () => {
    const rule = cssRule('.back-control');

    expect(rule).toMatch(/display: inline-flex;/u);
    expect(rule).toMatch(/gap: var\(--spaceXs\);/u);
    expect(rule).toMatch(/min-height: var\(--sizeHit\);/u);
    expect(rule).toMatch(/text-decoration: none;/u);
  });

  it('is the only place on the web that draws a back ‹ (sc-25608)', () => {
    const drawing = readdirSync(SOURCE, { recursive: true, encoding: 'utf8' })
      .filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
      .filter((file) => readFileSync(join(SOURCE, file), 'utf8').includes('>‹'));

    expect(drawing).toEqual(['components/BackControl.tsx']);
  });
});
