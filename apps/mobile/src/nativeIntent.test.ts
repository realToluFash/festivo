import { afterEach, describe, expect, it, vi } from 'vitest';

import { redirectSystemPath } from '../app/+native-intent.tsx';
import { holdLeaving, keptEditing } from './leaveHeld.ts';

const router = vi.hoisted(() => ({ dismissTo: vi.fn() }));

vi.mock('expo-router', () => ({ router }));

const link = { path: 'soirely://events/e1?area=guests', initial: false };

describe('a link while a form holds a change (sc-82245)', () => {
  let release = () => {};

  afterEach(() => {
    release();
    router.dismissTo.mockClear();
  });

  it('opens as it always has when nothing holds it', () => {
    expect(redirectSystemPath(link)).toBe(link.path);
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('opens the app’s first link without asking', () => {
    release = holdLeaving(() => {
      throw new Error('asked');
    });

    expect(redirectSystemPath({ ...link, initial: true })).toBe(link.path);
  });

  it('kept editing: the link opens nothing', async () => {
    release = holdLeaving(() => keptEditing());

    await expect(redirectSystemPath(link)).resolves.toBeNull();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });

  it('discarded: the form shuts, then the app goes where the link points', async () => {
    const order: string[] = [];
    router.dismissTo.mockImplementation((href: string) => order.push(`went ${href}`));
    release = holdLeaving(
      (go) => go(),
      () => {},
      () => order.push('closed'),
    );

    await expect(redirectSystemPath(link)).resolves.toBeNull();
    expect(order).toEqual(['closed', 'went /events/e1?area=guests']);
  });
});
