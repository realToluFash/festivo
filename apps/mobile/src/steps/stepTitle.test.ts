import { describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ OS: 'ios' as 'ios' | 'android' }));

vi.mock('react-native', () => ({ Platform: platform }));

const { stepTitle } = await import('./stepTitle.ts');

describe('stepTitle', () => {
  it('tracks the title in by 2% on iOS', () => {
    platform.OS = 'ios';

    expect(stepTitle(28)).toEqual({ letterSpacing: -0.56 });
  });

  it('leaves the title untracked on Android, which would drop its last word', () => {
    platform.OS = 'android';

    expect(stepTitle(28)).toEqual({});
  });
});
