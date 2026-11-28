import { describe, expect, it } from 'vitest';

import { headerLanguageOf, headerScreenOf, headerSizeOf, scaleFor } from './focusedHeaderRules.ts';

describe('the demo’s choices', () => {
  it('reads each from its route parameter', () => {
    expect(headerSizeOf('twelfth')).toBe('twelfth');
    expect(headerSizeOf(undefined)).toBe('phone');
    expect(headerLanguageOf('fr')).toBe('fr');
    expect(headerLanguageOf('es')).toBe('en');
    expect(headerScreenOf('due-now')).toBe('due-now');
    expect(headerScreenOf('nope')).toBe('name');
    expect(scaleFor('android', 1.3)).toBe(2);
    expect(scaleFor('phone', 1.3)).toBe(1.3);
  });
});
