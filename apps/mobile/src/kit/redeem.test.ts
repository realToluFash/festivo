import { ApiError, ApiUnreachableError, type OpenedDoorCode } from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  codeProblem,
  eventLine,
  joinRefusal,
  nameProblem,
  normalCode,
  openedTo,
  refusedTo,
  tryAgainWords,
} from './redeem.ts';

/** As RedeemController answers it (DoorCodesTest): the problem's type, title and detail, and Retry-After on a 429. */
function refused(
  code: string,
  status: number,
  detail?: string,
  headers: Record<string, string> = {},
): ApiError {
  const problem = {
    type: `https://soirely.com/errors/${code}`,
    title: 'Refused.',
    status,
    ...(detail == null ? {} : { detail }),
  };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status, headers }));
}

/** GET /api/door-codes/{code}, as DoorCodesTest reads it signed out. */
const OPENED: OpenedDoorCode = {
  role: 'can_check_in',
  jobLabel: 'Bar and drinks',
  event: {
    id: '0193a5c2-0000-7000-8000-000000000001',
    name: 'Owambe',
    startsAt: '2026-11-14T15:00:00+00:00',
    endsAt: '2026-11-14T23:30:00+00:00',
    timeZone: 'Europe/Lisbon',
    organisation: 'Ìrè Events',
  },
  standing: null,
};

const t = ((key: string, options?: Record<string, string>) =>
  options == null ? key : `${key} ${JSON.stringify(options)}`) as unknown as TFunction;

describe('a door code as typed', () => {
  it('is the same code in any case, with spaces and hyphens ignored', () => {
    expect(normalCode('q7km - 4xp2')).toBe('Q7KM4XP2');
    expect(codeProblem('q7km - 4xp2')).toBeNull();
  });

  it('is required', () => {
    expect(codeProblem('')).toBe('blank');
    expect(codeProblem(' - ')).toBe('blank');
  });

  it('is 8 letters and numbers', () => {
    expect(codeProblem('Q7KM 4X')).toBe('short');
    expect(codeProblem('Q7KM 4XP2 9')).toBe('short');
    expect(codeProblem('Q7KM 4XP!')).toBe('short');
  });
});

describe('the name a person joins under', () => {
  it('is required, and spaces alone are none', () => {
    expect(nameProblem('   ')).toBe(true);
    expect(nameProblem(' Adébáyọ̀ ')).toBe(false);
  });
});

describe('where an opened code leads', () => {
  it('is its event, signed out and once already in', () => {
    expect(openedTo('Q7KM4XP2', OPENED)).toEqual({
      kind: 'event',
      code: 'Q7KM4XP2',
      opened: OPENED,
    });
    expect(openedTo('Q7KM4XP2', { ...OPENED, standing: 'in' }).kind).toBe('event');
  });

  it("is the member's refusal for a member of its organisation", () => {
    expect(openedTo('Q7KM4XP2', { ...OPENED, standing: 'member' })).toEqual({
      kind: 'member',
      organisation: 'Ìrè Events',
      eventId: OPENED.event.id,
    });
  });

  it('is the one refusal for every bad code', () => {
    expect(refusedTo(refused('door_code_invalid', 404))).toEqual({
      kind: 'enter',
      line: 'refused',
    });
  });

  it('is the way there failing when nothing answered', () => {
    expect(refusedTo(new ApiUnreachableError())).toEqual({ kind: 'enter', line: 'failed' });
    expect(refusedTo(refused('internal_error', 500))).toEqual({ kind: 'enter', line: 'failed' });
  });

  it('is too many tries, lifting at the minute Retry-After gives', () => {
    const now = new Date(2030, 10, 1, 12, 0, 20);
    const answer = refusedTo(
      refused(
        'too_many_attempts',
        429,
        'Too many tries. Try again Friday 1 November at 12:01 UTC.',
        { 'Retry-After': '40' },
      ),
      now,
    );

    expect(answer).toEqual({
      kind: 'tooMany',
      lifts: new Date(2030, 10, 1, 12, 1),
      words: 'Too many tries. Try again Friday 1 November at 12:01 UTC.',
    });
  });
});

describe('a refused Join', () => {
  it("is the member's refusal on already_a_member", () => {
    expect(joinRefusal(refused('already_a_member', 409))).toEqual({ kind: 'member' });
  });

  it('is the one refusal for a code that filled or stopped meanwhile', () => {
    expect(joinRefusal(refused('door_code_invalid', 404))).toEqual({
      kind: 'trouble',
      trouble: 'refused',
    });
  });

  it('is the way there failing otherwise', () => {
    expect(joinRefusal(new ApiUnreachableError())).toEqual({
      kind: 'trouble',
      trouble: 'failed',
    });
  });

  it('is too many tries on a 429', () => {
    expect(joinRefusal(refused('too_many_attempts', 429)).kind).toBe('tooMany');
  });
});

describe('Try again at', () => {
  const now = new Date(2030, 10, 1, 13, 0);

  it('is the minute alone today', () => {
    expect(
      tryAgainWords(
        t,
        { kind: 'tooMany', lifts: new Date(2030, 10, 1, 13, 32), words: '' },
        'en-GB',
        now,
      ),
    ).toBe('redeem.tryAt {"when":"13:32"}');
  });

  it('names the day when it is another', () => {
    expect(
      tryAgainWords(
        t,
        { kind: 'tooMany', lifts: new Date(2030, 10, 2, 0, 1), words: '' },
        'en-GB',
        now,
      ),
    ).toMatch(/^redeem\.tryAt \{"when":".+ 00:01"\}$/u);
  });

  it("is the server's words with no Retry-After", () => {
    expect(
      tryAgainWords(t, { kind: 'tooMany', lifts: null, words: 'Too many tries.' }, 'en-GB', now),
    ).toBe('Too many tries.');
  });
});

describe("the event's line", () => {
  it('is its day on its own clock, the organisation, the level and the job', () => {
    expect(eventLine(t, OPENED, 'en-GB')).toBe(
      'Sat 14 Nov · Ìrè Events · eventPeople.role.can_check_in · Bar and drinks',
    );
  });

  it('leaves out a job the code has none of', () => {
    expect(eventLine(t, { ...OPENED, jobLabel: null }, 'en-GB')).toBe(
      'Sat 14 Nov · Ìrè Events · eventPeople.role.can_check_in',
    );
  });
});
