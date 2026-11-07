import { initials } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { samplePeople } from './MembersSample.ts';
import { VIEWER_PERSON, YOU } from './sample.ts';

describe('The Confetti card face, drawn from a name', () => {
  it('follows a saved name on Your account', () => {
    expect(initials('Oluwafolakemi Bello')).toBe('OB');
    expect(initials('Cher')).toBe('C');
    expect(initials(YOU.name)).toBe(YOU.initials);
  });

  it('keeps every face on Members as the sample had it', () => {
    for (const person of [...samplePeople(), ...Object.values(VIEWER_PERSON)]) {
      expect(initials(person.name), person.name).toBe(person.initials);
    }
  });
});
