import { ApiError, ApiUnreachableError } from '@soirely/api-client';
import { NotReached } from '@soirely/domain';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { forgetKept, keptLoad, rekeep, useKeptAsShown } from './tabKept.ts';

const refused = () => new ApiError({ type: 'about:blank', title: 'Broken', status: 500 });

describe("this tab's memory of what loaded (sc-65646)", () => {
  it('stands a load that never reached Soirely on the last one answered', async () => {
    await keptLoad('guests:ev_1', Promise.resolve(['Ada']));

    await expect(keptLoad('guests:ev_1', Promise.reject(new TypeError('Failed')))).resolves.toEqual(
      ['Ada'],
    );
    await expect(keptLoad('guests:ev_1', Promise.reject(new NotReached()))).resolves.toEqual([
      'Ada',
    ]);
    await expect(
      keptLoad('guests:ev_1', Promise.reject(new ApiUnreachableError(new TypeError('Failed')))),
    ).resolves.toEqual(['Ada']);
  });

  it('keeps nothing for a load Soirely refused, or one this tab never had answered', async () => {
    await keptLoad('guests:ev_1', Promise.resolve(['Ada']));

    await expect(keptLoad('guests:ev_1', Promise.reject(refused()))).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(
      keptLoad('guests:ev_1', Promise.reject(new ApiUnreachableError())),
    ).rejects.toBeInstanceOf(ApiUnreachableError);
    await expect(
      keptLoad('guests:ev_2', Promise.reject(new TypeError('Failed'))),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('changes what is kept for a change the page made, never what it has not kept', async () => {
    await keptLoad('menu:ev_1', Promise.resolve('before'));
    rekeep('menu:ev_1', 'after');
    rekeep('menu:ev_2', 'never');

    await expect(keptLoad('menu:ev_1', Promise.reject(new TypeError('Failed')))).resolves.toBe(
      'after',
    );
    await expect(
      keptLoad('menu:ev_2', Promise.reject(new TypeError('Failed'))),
    ).rejects.toBeInstanceOf(TypeError);
  });

  it('stands on what the page shows after the host’s own edit, not on the load before it', async () => {
    await keptLoad('schedule:ev_1', Promise.resolve('loaded'));
    const { rerender } = renderHook(({ shown }) => useKeptAsShown('schedule:ev_1', shown), {
      initialProps: { shown: 'loaded' as string | null },
    });

    rerender({ shown: 'moved' });
    rerender({ shown: null });

    await expect(keptLoad('schedule:ev_1', Promise.reject(new TypeError('Failed')))).resolves.toBe(
      'moved',
    );
  });

  it('forgets everything on signing out or changing organisation', async () => {
    await keptLoad('guests:ev_1', Promise.resolve(['Ada']));

    forgetKept();

    await expect(
      keptLoad('guests:ev_1', Promise.reject(new TypeError('Failed'))),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
