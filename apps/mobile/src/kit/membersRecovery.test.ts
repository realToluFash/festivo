import { ApiError, type RecoveryRequest } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  ownLine,
  recoveryAnswerable,
  recoveryEndedByRemoval,
  recoveryFacts,
  recoveryGone,
  recoveryHeard,
  recoveryQuestion,
  recoveryShownIn,
} from './membersRecovery.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

function asking(id: string, name: string, more: Partial<RecoveryRequest> = {}): RecoveryRequest {
  return {
    id,
    userId: `user_${id}`,
    name,
    email: `${id}@ire.events`,
    provedPhone: true,
    own: false,
    organisations: ['Ìrè Events'],
    organisationIds: ['org_ire'],
    asked: 'Tuesday, Nov 3 at 18:05 WAT',
    expires: 'Tuesday, Nov 10 at 18:05 WAT',
    ...more,
  };
}

const kofi = asking('kofi', 'Kofi Mensah');
const priya = asking('priya', 'Priya Shah', { provedPhone: false });
const julien = asking('julien', 'Julien Moreau', {
  own: true,
  organisations: ['Ìrè Events', 'Hall Events'],
  organisationIds: ['org_ire', 'org_hall'],
});

function refusal(status: number, type: string): ApiError {
  return new ApiError({ type, title: '', status });
}

describe('requests to get back in on Members (sc-30894)', () => {
  it('shows only the requests of the organisation Members is showing', () => {
    const elsewhere = asking('ada', 'Ada Obi', { organisationIds: ['org_hall'] });

    expect(recoveryShownIn([kofi, elsewhere, julien], 'org_hall')).toEqual([elsewhere, julien]);
    expect(recoveryShownIn([kofi, elsewhere, julien], 'org_ire')).toEqual([kofi, julien]);
  });

  it('never counts your own request, and a removal ends only the removed person’s', () => {
    expect(recoveryAnswerable([kofi, julien, priya])).toEqual([kofi, priya]);
    expect(recoveryEndedByRemoval([kofi, priya], 'user_priya')).toEqual([kofi]);
    expect(recoveryEndedByRemoval([kofi, priya], 'user_lucia')).toEqual([kofi, priya]);
  });

  it('says how each proved it, theirs or yours', () => {
    expect(recoveryFacts(t, kofi)).toEqual([
      'kofi@ire.events',
      'Asked to turn off two-factor · Proved with codes to their email and phone',
      'Asked Tuesday, Nov 3 at 18:05 WAT · ends Tuesday, Nov 10 at 18:05 WAT if nobody answers',
    ]);
    expect(recoveryFacts(t, priya)[1]).toBe(
      'Asked to turn off two-factor · Proved with a code to their email (no verified phone)',
    );
    expect(recoveryFacts(t, julien)[1]).toBe(
      'Asked to turn off two-factor · Proved with codes to your email and phone',
    );
  });

  it('is heard as one group, in the AC’s order', () => {
    expect(recoveryHeard(t, julien)).toBe(
      'Waiting for an answer. Asked to turn off two-factor. ' +
        'They lost their authenticator and their recovery codes, and stay signed out until somebody answers. One answer from an owner or admin is enough. Approve only if you’re sure it’s them, for example by calling them on a number you already have. ' +
        'Julien Moreau (you), julien@ire.events. Proved with codes to your email and phone. ' +
        'Asked Tuesday, Nov 3 at 18:05 WAT · ends Tuesday, Nov 10 at 18:05 WAT if nobody answers.',
    );
  });

  it('names the organisations that answer your own, as a list', () => {
    expect(ownLine(t, julien, 'en')).toBe(
      'This is your own request. Somebody else in Ìrè Events and Hall Events has to answer it.',
    );
  });

  it('treats a closed request and a 404 as gone, and anything else as a failure', () => {
    expect(recoveryGone(refusal(409, 'recovery_request_closed'))).toBe(true);
    expect(recoveryGone(refusal(404, 'not_found'))).toBe(true);
    expect(recoveryGone(refusal(500, 'server_error'))).toBe(false);
    expect(recoveryGone(new TypeError('Network request failed'))).toBe(false);
  });

  it('asks before an approval, Cancel first and the red verb last', () => {
    const ask = recoveryQuestion(
      t,
      { id: 'kofi', answer: 'approve', phase: 'asking' },
      'Kofi Mensah',
    );

    expect(ask.title).toBe('Approve, and turn off Kofi Mensah’s two-factor?');
    expect(ask.keep).toEqual({ label: 'Cancel', testID: 'members.recovery.cancel', off: false });
    expect(ask.confirm).toEqual({
      label: 'Turn off two-factor',
      testID: 'members.recovery.turnOff',
      removes: true,
      busy: undefined,
    });
  });

  it('holds the confirm while the answer is out, and says a failure under the line', () => {
    const sending = recoveryQuestion(
      t,
      { id: 'kofi', answer: 'turnDown', phase: 'sending' },
      'Kofi Mensah',
    );
    const failed = recoveryQuestion(
      t,
      { id: 'kofi', answer: 'turnDown', phase: 'failed' },
      'Kofi Mensah',
    );

    expect(sending.title).toBe('Turn down Kofi Mensah’s request?');
    expect(sending.keep?.off).toBe(true);
    expect(sending.confirm?.busy).toBe('Sending your answer…');
    expect(failed.failed).toBe('That did not work. Try again in a moment.');
    expect(failed.confirm?.label).toBe('Turn down the request');
  });

  it('offers Close alone once the request has gone, keeping the title', () => {
    const closed = recoveryQuestion(
      t,
      { id: 'kofi', answer: 'approve', phase: 'closed' },
      'Kofi Mensah',
    );

    expect(closed.title).toBe('Approve, and turn off Kofi Mensah’s two-factor?');
    expect(closed.line).toBe('This request has already been answered, or it has ended.');
    expect(closed.alert).toBe(true);
    expect(closed.keep?.label).toBe('Close');
    expect(closed.confirm).toBeNull();
  });
});
