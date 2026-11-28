import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 15000 };
const PANE = 600;
const STEP = 1000;

const scrolled = new WeakMap<Element, number>();
const original = {
  rect: Element.prototype.getBoundingClientRect,
  top: Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop'),
};

function isStream(list: Element | null): list is HTMLOListElement {
  return list instanceof HTMLOListElement && list.classList.contains('mg-stream');
}

function sized(): void {
  Object.defineProperty(HTMLOListElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => PANE,
  });
  Object.defineProperty(HTMLOListElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLOListElement) {
      return this.children.length * STEP + PANE;
    },
  });
  Object.defineProperty(HTMLOListElement.prototype, 'scrollTop', {
    configurable: true,
    get(this: HTMLOListElement) {
      return scrolled.get(this) ?? 0;
    },
    set(this: HTMLOListElement, to: number) {
      scrolled.set(this, Math.min(Math.max(0, to), this.scrollHeight - this.clientHeight));
    },
  });
  Element.prototype.getBoundingClientRect = function rect(this: Element): DOMRect {
    const list = this.parentElement;

    if (isStream(this)) return { top: 100 } as DOMRect;
    if (isStream(list)) {
      return {
        top: 100 + Array.from(list.children).indexOf(this) * STEP - list.scrollTop,
      } as DOMRect;
    }

    return original.rect.call(this);
  };
}

function unsized(): void {
  for (const key of ['clientHeight', 'scrollHeight', 'scrollTop']) {
    Reflect.deleteProperty(HTMLOListElement.prototype, key);
  }
  if (original.top != null) Object.defineProperty(Element.prototype, 'scrollTop', original.top);
  Element.prototype.getBoundingClientRect = original.rect;
}

async function messages(state: string): Promise<void> {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4/messages?state=${state}`],
  });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function atNewest(): void {
  const streams = Array.from(document.querySelectorAll('ol.mg-stream'));

  expect(streams).toHaveLength(1);
  const [list] = streams as HTMLOListElement[];

  expect(list!.children.length).toBeGreaterThan(1);
  expect(list!.scrollTop).toBe((list!.children.length - 1) * STEP);
}

describe('Every conversation opens at its newest message, as drawn (sc-3942, #94879)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
    sized();
  });

  afterEach(() => {
    cleanup();
    unsized();
  });

  it.each([
    ['a message taller than the pane', 'tallMessage'],
    ['a follow-up under a tall message', 'tallFollowUp'],
    ['a guest’s conversation', 'conversation'],
    ['a scheduled message', 'scheduled'],
    ['a message sent to a saved audience', 'resolvedRow'],
  ])('opens %s at its newest', SLOW, async (_, state) => {
    await messages(state);

    atNewest();
  });

  it('opens the follow-up composer at the message it follows', SLOW, async () => {
    await messages('sent');

    fireEvent.change(screen.getByRole('textbox', { name: 'Write a follow-up' }), {
      target: { value: 'One more thing.' },
    });
    await screen.findByRole('log', { name: 'Write a follow-up' });

    atNewest();
  });
});
