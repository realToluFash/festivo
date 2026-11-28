import { describe, expect, it } from 'vitest';

import { SAMPLE } from './samples.ts';
import { TIMED_OUT, createOpening } from './signUp.ts';

describe('Create your account after a sign-up runs out (sc-29923)', () => {
  it('opens blank, with nothing said, on an ordinary visit', () => {
    expect(createOpening({})).toEqual({ name: '', email: '', line: null, focus: 'name' });
    expect(createOpening({ state: 'runOut', name: 'Ada', email: 'ada@example.com' }).line).toBe(
      null,
    );
  });

  it('keeps the name and email, not the password, says why and puts focus on Password', () => {
    expect(createOpening({ state: 'timedOut', name: 'Ada Obi', email: 'ada@example.com' })).toEqual(
      { name: 'Ada Obi', email: 'ada@example.com', line: TIMED_OUT, focus: 'password' },
    );
    expect(createOpening({ state: 'timedOut' })).toMatchObject({
      name: SAMPLE.name,
      email: SAMPLE.email,
    });
  });

  it('keeps only the email when the app was opened again, as it holds no name', () => {
    expect(createOpening({ state: 'timedOutReopened', name: 'Ada Obi' })).toEqual({
      name: '',
      email: SAMPLE.email,
      line: TIMED_OUT,
      focus: 'password',
    });
  });

  it('says it in the web’s words', () => {
    expect(TIMED_OUT).toBe(
      'Your sign-up timed out, so we did not keep the password. Enter it again to get a new code.',
    );
  });
});
