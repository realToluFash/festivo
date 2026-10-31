import { afterEach, describe, expect, it } from 'vitest';
import { motion } from './leaving';

describe('motion', () => {
  afterEach(() => document.documentElement.style.removeProperty('--motionFast'));

  it.each([
    ['120ms', 120],
    ['.12s', 120],
    ['0.2s', 200],
  ])('reads %s as %d milliseconds', (written, ms) => {
    document.documentElement.style.setProperty('--motionFast', written);

    expect(motion('motionFast')).toBe(ms);
  });
});
