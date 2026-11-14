import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  STATE_KEYS,
  type Standing,
  U,
  UNSUBSCRIBE_PAGES,
  openingOf,
  pageOf,
} from './unsubscribe.ts';

const STANDINGS: readonly Standing[] = ['on', 'off', 'backOn', 'unknown'];

describe('the unsubscribe page’s words and states (sc-4331)', () => {
  it('keeps English copy (l10n) word for word', () => {
    expect(pageOf('on')).toEqual({
      mark: 'envelope',
      title: 'Guest reply emails',
      save: { label: 'Turn off guest reply emails', to: 'off' },
      settings: true,
    });
    expect(pageOf('off')).toMatchObject({
      mark: 'envelopeOff',
      title: 'Guest reply emails are off',
      body: 'You will still see replies in the bell, and push is as you set it.',
      save: { label: 'Turn them back on', to: 'backOn' },
    });
    expect(pageOf('backOn')).toEqual({
      mark: 'envelopeTick',
      title: 'Guest reply emails are back on',
      body: 'Your guest summary will arrive in the morning when there is something new.',
      settings: true,
    });
    expect(pageOf('unknown')).toEqual({
      mark: 'brokenLink',
      title: 'This link does not work',
      body: 'Nothing has changed. To turn guest reply emails on or off, sign in and open your notification settings.',
      signIn: true,
      settings: false,
    });
    expect(U.failed).toBe('Saving did not work. Nothing has changed.');
    expect(U.saving).toBe('Saving…');
  });

  it('leads with one button, ends every page but the unknown link with Notification settings', () => {
    for (const standing of STANDINGS) {
      const page = pageOf(standing);
      expect(page.settings).toBe(standing !== 'unknown');
      expect(page.save != null && page.signIn === true).toBe(false);
    }
    expect(pageOf('backOn').save).toBeUndefined();
  });

  it('opens each state at its key, and anything else as on', () => {
    expect(openingOf('saving')).toEqual({ standing: 'on', saving: true, failed: false });
    expect(openingOf('failed')).toEqual({ standing: 'on', saving: false, failed: true });
    expect(openingOf('backOn').standing).toBe('backOn');
    expect(openingOf(null)).toEqual({ standing: 'on', saving: false, failed: false });
    expect(openingOf('elsewhere').standing).toBe('on');
  });

  it('lists every state on the demo home', () => {
    expect(UNSUBSCRIBE_PAGES.flatMap((page) => page.states.map((state) => state.to))).toEqual(
      STATE_KEYS.map((key) => `/demo/unsubscribe?state=${key}`),
    );
  });

  it('writes sentence case with no em dash, and names no member, address or event', () => {
    const words = [
      ...Object.values(U),
      ...UNSUBSCRIBE_PAGES.flatMap((page) => [page.name, ...page.states.map((s) => s.name)]),
    ];
    for (const word of words) {
      expect(word).not.toMatch(/—|@|\{/u);
      expect(word.slice(1)).not.toMatch(/\b(Guest|Reply|Emails|Turn|Settings)\b/u);
    }
  });

  it('holds the phone’s gutters: 24 a side, 16 under 360', () => {
    const css = readFileSync(join(import.meta.dirname, 'unsubscribe.css'), 'utf8');

    expect(css).toMatch(
      /@media \(width <= 40rem\) \{[^@]*padding: var\(--space5xl\) var\(--space3xl\) var\(--space3xl\);/u,
    );
    expect(css).toMatch(/@media \(width < 22\.5rem\) \{[^@]*padding-inline: var\(--spaceXl\);/u);
    expect(css).toMatch(/\.unsub-mark \{[^}]*width: 56px;[^}]*height: 56px;/u);
  });
});
