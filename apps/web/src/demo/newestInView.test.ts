import { describe, expect, it } from 'vitest';

import { TALL_BODY, seedOf } from './messages.ts';
import { newestInView } from './newestInView.ts';

const PANE = 600;

function stream(tops: readonly number[], height: number) {
  const list = document.createElement('ol');
  let scrollTop = 0;
  const max = () => Math.max(0, height - PANE);

  Object.defineProperty(list, 'clientHeight', { get: () => PANE });
  Object.defineProperty(list, 'scrollHeight', { get: () => height });
  Object.defineProperty(list, 'scrollTop', {
    get: () => scrollTop,
    set: (to: number) => {
      scrollTop = Math.min(Math.max(0, to), max());
    },
  });
  list.getBoundingClientRect = () => ({ top: 100 }) as DOMRect;

  const add = (top: number) => {
    const item = document.createElement('li');

    item.getBoundingClientRect = () => ({ top: 100 + top - scrollTop }) as DOMRect;
    list.append(item);
  };

  tops.forEach(add);

  return {
    list,
    add,
    grow: (to: number) => {
      height = to;
    },
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('A conversation opens at its newest message, and follows it (sc-3942, #94879)', () => {
  it('opens at the foot when the newest message fits the pane', () => {
    const { list } = stream([0, 2000, 2400], 2600);

    newestInView(list);

    expect(list.scrollTop).toBe(2000);
  });

  it('opens at the start of a newest message taller than the pane', () => {
    const { list } = stream([0, 300], 3600);

    newestInView(list);

    expect(list.scrollTop).toBe(300);
  });

  it('follows a message the host adds, its Sending… in view', async () => {
    const pane = stream([0, 300], 3600);

    newestInView(pane.list);
    pane.grow(3800);
    pane.add(3600);
    await settle();

    expect(pane.list.scrollTop).toBe(3200);
  });

  it('leaves a reader who scrolled up where they are when the newest changes, and still follows a new message', async () => {
    const pane = stream([0, 300], 3600);

    newestInView(pane.list);
    pane.list.scrollTop = 1200;
    pane.list.dispatchEvent(new Event('scroll'));
    pane.list.lastElementChild?.append('Sent');
    await settle();

    expect(pane.list.scrollTop).toBe(1200);

    pane.grow(3800);
    pane.add(3600);
    await settle();

    expect(pane.list.scrollTop).toBe(3200);
  });

  it('stops when the conversation closes', async () => {
    const pane = stream([0, 300], 3600);
    const stop = newestInView(pane.list);

    stop?.();
    pane.list.scrollTop = 0;
    pane.grow(3800);
    pane.add(3600);
    await settle();

    expect(pane.list.scrollTop).toBe(0);
  });

  it('draws a thread taller than the pane, under the Message’s 10,000', () => {
    const tall = seedOf('tallMessage');
    const follow = seedOf('tallFollowUp');

    expect(TALL_BODY.length).toBeGreaterThan(3000);
    expect(TALL_BODY.length).toBeLessThan(10000);
    expect(tall.outs).toHaveLength(1);
    expect(follow.outs.map((one) => one.stage)).toEqual(['sent', 'sending']);
  });
});
