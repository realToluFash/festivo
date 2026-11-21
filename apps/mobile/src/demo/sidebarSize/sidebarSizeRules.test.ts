import { describe, expect, it } from 'vitest';

import { sideTextSize } from '../../layout/sidebarSize.ts';

import {
  sidebarAtOf,
  sidebarOrgName,
  sidebarOrgOf,
  sidebarScale,
  sidebarSizeOf,
  sidebarWaitingOf,
  WAITING_ROOM,
  waitingCount,
} from './sidebarSizeRules.ts';

describe('the sidebar size board', () => {
  it('opens on This iPad and Members when the link names neither', () => {
    expect(sidebarSizeOf(undefined)).toBe('device');
    expect(sidebarScale('device', 1.4)).toBe(1.4);
    expect(sidebarAtOf('nowhere')).toBe('members');
  });

  it('offers the eighth step at the scale React Native gives AX1 on iOS', () => {
    expect(sidebarScale(sidebarSizeOf('eighth'), 1)).toBe(1.786);
  });

  it('names the organisation Ire Events unless the link asks for QA Organisation', () => {
    expect(sidebarOrgName(sidebarOrgOf(undefined))).toBe('Ire Events');
    expect(sidebarOrgName(sidebarOrgOf('qa'))).toBe('QA Organisation');
  });

  it('shows no invitations line unless the link asks for one or two', () => {
    expect(waitingCount(sidebarWaitingOf(undefined))).toBe(0);
    expect(waitingCount(sidebarWaitingOf('two'))).toBe(2);
  });

  it('steps the invitations line down on its own to fit whole on one line, never below main', () => {
    const scale = sidebarScale('twelfth', 1);
    const start = WAITING_ROOM.size * scale;
    const wide = { width: WAITING_ROOM.inside * 1.6, letters: 14 };
    const stepped = sideTextSize(WAITING_ROOM, scale, { words: [wide], whole: wide }, 'line');
    expect(stepped).toBeLessThan(start);
    expect(stepped).toBeGreaterThanOrEqual(WAITING_ROOM.size);
    expect((wide.width * stepped) / start).toBeLessThanOrEqual(WAITING_ROOM.inside);

    const fits = { width: WAITING_ROOM.inside - 1, letters: 14 };
    expect(sideTextSize(WAITING_ROOM, scale, { words: [fits], whole: fits }, 'line')).toBe(start);
  });

  it('draws the invitations line at main’s size at the default step', () => {
    const wide = { width: WAITING_ROOM.inside * 3, letters: 14 };
    expect(sideTextSize(WAITING_ROOM, 1, { words: [wide], whole: wide }, 'line')).toBe(12.5);
  });
});
