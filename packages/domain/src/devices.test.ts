import { describe, expect, it } from 'vitest';

import { thisDeviceFirst } from './devices.ts';

const newest = { id: 'newest' };
const here = { id: 'here' };
const oldest = { id: 'oldest' };

describe('the devices list', () => {
  it('puts this device first even when another signed in after it', () => {
    expect(thisDeviceFirst([newest, here, oldest], 'here')).toEqual([here, newest, oldest]);
  });

  it('keeps the order it was given when this device is not in it', () => {
    expect(thisDeviceFirst([newest, here, oldest], null)).toEqual([newest, here, oldest]);
  });
});
