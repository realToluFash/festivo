import { describe, expect, it } from 'vitest';

import { sidebarAtOf, sidebarScale, sidebarSizeOf } from './sidebarSizeRules.ts';

describe('the sidebar size board', () => {
  it('opens on This iPad and Members when the link names neither', () => {
    expect(sidebarSizeOf(undefined)).toBe('device');
    expect(sidebarScale('device', 1.4)).toBe(1.4);
    expect(sidebarAtOf('nowhere')).toBe('members');
  });
});
