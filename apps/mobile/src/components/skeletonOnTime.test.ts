import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const skeleton = readFileSync(join('src', 'components', 'Skeleton.tsx'), 'utf8');
const appear = skeleton.slice(
  skeleton.indexOf('function useAppear('),
  skeleton.indexOf('function usePulse('),
);

describe('the skeleton appears after its second on the UI thread, whatever holds JS (sc-83081)', () => {
  it('steps from 0 to 1 over SKELETON_AFTER_MS on the native driver, started in the commit', () => {
    expect(appear).toContain('duration: SKELETON_AFTER_MS,');
    expect(appear).toContain('easing: (progress) => (progress < 1 ? 0 : 1),');
    expect(appear).toContain('useNativeDriver: true,');
    expect(appear).toContain('useLayoutEffect(');
    expect(appear).not.toContain('delay');
  });

  it('draws the words and the rows through that value, not through the JS timer', () => {
    expect(skeleton).toContain('style={{ opacity: appear }}');
    expect(skeleton).toContain('Animated.multiply(appear, pulse)');
    expect(skeleton).not.toMatch(/\{shown && \(\s*<Text/u);
    expect(skeleton).not.toContain('opacity: shown ? pulse : 0');
  });
});
