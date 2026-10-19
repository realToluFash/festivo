import { describe, expect, it } from 'vitest';

import { signedOutHold } from './signedOutHold.ts';

function counting() {
  const redirects: string[] = [];
  const hold = signedOutHold(() => redirects.push('/sign-in?signedOut=1'));

  return { hold, redirects };
}

describe('the signed-out redirect at launch', () => {
  it('records a sign-out during the hold, and does not redirect', async () => {
    const { hold, redirects } = counting();

    const answer = await hold.during(async () => {
      hold.onSignedOut();
      throw new Error('401');
    });

    expect(answer).toMatchObject({ ended: true });
    expect('error' in answer).toBe(true);
    expect(redirects).toEqual([]);
  });

  it('redirects a sign-out once the hold is over', async () => {
    const { hold, redirects } = counting();

    await hold.during(async () => 'signed in');
    hold.onSignedOut();

    expect(redirects).toEqual(['/sign-in?signedOut=1']);
  });

  it('is released when the work rejects', async () => {
    const { hold, redirects } = counting();

    await hold.during(async () => {
      throw new Error('unreachable');
    });
    hold.onSignedOut();

    expect(redirects).toEqual(['/sign-in?signedOut=1']);
  });

  it('reports no ended session when none was found', async () => {
    const { hold } = counting();

    await expect(hold.during(async () => 'signed in')).resolves.toEqual({
      value: 'signed in',
      ended: false,
    });
  });

  it('keeps the API’s reason, at launch and after it (sc-69)', async () => {
    const reasons: unknown[] = [];
    const hold = signedOutHold((why) => reasons.push(why));
    const why = { type: 'https://soirely.com/errors/session_timed_out', title: 'No.', status: 401 };

    const answer = await hold.during(async () => {
      hold.onSignedOut(why);
      throw new Error('401');
    });
    hold.onSignedOut(why);

    expect(answer).toMatchObject({ ended: true, why });
    expect(reasons).toEqual([why]);
  });
});
