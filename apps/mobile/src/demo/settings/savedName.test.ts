import { afterEach, describe, expect, it } from 'vitest';

import { lookingAs, memberLooking } from './sample.ts';
import { forgetName, saveName, savedName, underSavedName } from './savedName.ts';

describe('a name saved on Your account', () => {
  afterEach(() => forgetName());

  it('starts from the sample', () => {
    expect(savedName()).toBeNull();
    expect(underSavedName(lookingAs('owner'), savedName())).toMatchObject({
      name: 'Folake Adeyemi',
      initials: 'FA',
    });
  });

  it('gives you the saved name and its initials', () => {
    saveName('Oluwafolakemi Bello');

    expect(underSavedName(lookingAs('owner'), savedName())).toMatchObject({
      name: 'Oluwafolakemi Bello',
      initials: 'OB',
      role: 'Owner',
    });
  });

  it('takes one letter from a one-word name', () => {
    saveName('Cher');

    expect(underSavedName(lookingAs('noOrg'), savedName())).toMatchObject({
      name: 'Cher',
      initials: 'C',
    });
  });

  it('leaves whoever else the demo looks as alone', () => {
    saveName('Cher');

    expect(underSavedName(lookingAs('member'), savedName())).toMatchObject({
      name: 'Priya Shah',
      initials: 'PS',
    });
    expect(underSavedName(memberLooking('ana.souza@ire.events'), savedName())).toMatchObject({
      name: 'Ana Souza',
      initials: 'AS',
    });
  });

  it('is forgotten for a deep link', () => {
    saveName('Cher');
    forgetName();

    expect(savedName()).toBeNull();
  });
});
