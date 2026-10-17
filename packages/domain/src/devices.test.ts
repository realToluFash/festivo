import { describe, expect, it } from 'vitest';

import { othersOf, thisDeviceFirst } from './devices.ts';

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

  it('counts the others and keeps this device when it is in the list', () => {
    expect(othersOf([newest, here, oldest], 'here')).toEqual({ count: 2, sessionId: 'here' });
  });

  it('counts every session and keeps none when this device is not in the list', () => {
    expect(othersOf([newest, oldest], 'here')).toEqual({ count: 2, sessionId: null });
    expect(othersOf([newest, here], null)).toEqual({ count: 2, sessionId: null });
  });
});
