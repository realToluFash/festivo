import { describe, expect, it } from 'vitest';

import {
  sidebarAtOf,
  sidebarOrgName,
  sidebarOrgOf,
  sidebarScale,
  sidebarSizeOf,
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
});
