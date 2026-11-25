import { describe, expect, it } from 'vitest';

import { PILL_CHROME, phoneNameRoom, wholeTileAlone } from '../../layout/pillFit.ts';
import {
  TOP_SCREENS,
  topPillChrome,
  topPillNameRoom,
  topPillWaitingRoom,
  topUprightNameRoom,
  topUprightWaitingRoom,
} from './topSizeRules.ts';

const AX1 = 1.786;
const AX5 = 3.571;
const SEVENTH = 1.353;
// Search and the bell, 44 each with 8 between; the bell alone where Search is not offered.
const BOTH = 96;
const BELL = 44;

describe('the white pill over Settings, Events and the Calendar (sc-92464)', () => {
  it('gives the name 206 from AX1 on an iPhone 17 Pro with Search and the bell, where the pill is bare, and the invitation line 189', () => {
    expect(topPillNameRoom(362, BOTH, AX5)).toBe(206);
    expect(topPillWaitingRoom(362, BOTH, AX5)).toBe(189);
  });

  it('gives the name the room Search leaves when only the bell is drawn', () => {
    expect(topPillNameRoom(362, BELL, AX5)).toBe(258);
  });

  it('takes its chrome from the product pill and keeps the tile below AX1, as main does', () => {
    expect(topPillChrome(SEVENTH)).toBe(PILL_CHROME);
    expect(topPillChrome(SEVENTH) - topPillChrome(AX1)).toBe(36);
    expect(topPillNameRoom(362, BOTH, SEVENTH)).toBe(phoneNameRoom(362, BOTH));
    expect(topPillNameRoom(362, BOTH, SEVENTH)).toBe(170);
  });

  it('never gives a negative room', () => {
    expect(topPillNameRoom(0, BOTH, AX5)).toBe(0);
    expect(topPillWaitingRoom(100, BOTH, AX5)).toBe(0);
  });

  it('is its tile alone only for a word too wide for the bare pill’s line at 15', () => {
    expect(wholeTileAlone(380, topPillNameRoom(362, BOTH, AX5))).toBe(true);
    expect(wholeTileAlone(99, topPillNameRoom(362, BOTH, AX5))).toBe(false);
  });

  it('draws the three screens that share one top', () => {
    expect(TOP_SCREENS.map((one) => one.key)).toEqual(['settings', 'events', 'calendar']);
  });
});

describe('the white pill beside the upright iPad’s tabs over Settings (sc-92728)', () => {
  it('gives the bare pill’s name the tile’s room back from AX1', () => {
    expect(topUprightNameRoom(260, AX1) - topUprightNameRoom(260, SEVENTH)).toBe(36);
    expect(topUprightNameRoom(260, SEVENTH)).toBe(260 - PILL_CHROME);
  });

  it('gives the invitation line the name’s room less its ring', () => {
    expect(topUprightNameRoom(260, AX5) - topUprightWaitingRoom(260, AX5)).toBe(17);
  });

  it('never gives a negative room', () => {
    expect(topUprightNameRoom(0, AX5)).toBe(0);
    expect(topUprightWaitingRoom(20, AX5)).toBe(0);
  });
});
