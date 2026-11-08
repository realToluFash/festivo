import { initials } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { samplePeople } from './MembersSample.ts';
import { VIEWER_PERSON, YOU } from './sample.ts';

describe('the sample’s initials, now that the Confetti faces draw them from the name', () => {
  it('agree with each sample person’s name, you and everybody on Members', () => {
    for (const person of [YOU, ...samplePeople(), ...Object.values(VIEWER_PERSON)]) {
      expect(initials(person.name), person.name).toBe(person.initials);
    }
  });
});
