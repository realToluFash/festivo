import { ApiError } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import { EVENT_PHASES, type Translate } from '@soirely/domain';

import {
  PHASE_WORD,
  changedSinceOpening,
  draftRowOf,
  endRefusalOf,
  type LiveQuestion,
  liveAlertOf,
  pauseRefusalOf,
  refusalOf,
  toldOf,
} from './makeLive.ts';

const STARTS = '2026-11-14T16:00:00+01:00';
const ENDS = '2026-11-15T02:00:00+01:00';
const BEFORE = new Date('2026-11-15T00:59:59Z');
const AFTER = new Date('2026-11-15T01:00:00Z');

function problem(code: string, extra: Record<string, unknown> = {}): ApiError {
  return new ApiError({
    type: `https://soirely.com/errors/${code}`,
    title: code,
    status: 409,
    ...extra,
  });
}

describe('draftRowOf', () => {
  it('offers Make live on a draft to somebody with events.manage', () => {
    expect(draftRowOf({ status: 'draft', startsAt: STARTS, endsAt: ENDS }, BEFORE, true)).toEqual({
      line: 'guestsBlocked',
      offersMakeLive: true,
    });
  });

  it('shows the line without Make live to somebody without it', () => {
    expect(draftRowOf({ status: 'draft', startsAt: STARTS, endsAt: ENDS }, BEFORE, false)).toEqual({
      line: 'guestsBlocked',
      offersMakeLive: false,
    });
  });

  it('says the end has passed, with no Make live, once it has', () => {
    expect(draftRowOf({ status: 'draft', startsAt: STARTS, endsAt: ENDS }, AFTER, true)).toEqual({
      line: 'endPassed',
      offersMakeLive: false,
    });
  });

  it.each(['live', 'paused', 'ended'] as const)(
    'shows nothing on an event that is %s',
    (status) => {
      expect(draftRowOf({ status, startsAt: STARTS, endsAt: ENDS }, BEFORE, true)).toBeNull();
    },
  );
});

describe('changedSinceOpening', () => {
  const unhosted = { status: 'draft' as const, hosts: [] };
  const hosted = { status: 'draft' as const, hosts: ['Tayo'] };

  it('saves when the read on opening still has no host', () => {
    expect(changedSinceOpening(unhosted, unhosted)).toBe(false);
  });

  it('says what it found when somebody else named a host after the page loaded', () => {
    expect(changedSinceOpening(unhosted, hosted)).toBe(true);
  });

  it('says what it found when the event is no longer a Draft', () => {
    expect(changedSinceOpening(unhosted, { status: 'live', hosts: ['Tayo'] })).toBe(true);
  });

  it('only goes live on the retry after its own save went through and going live failed', () => {
    expect(changedSinceOpening(hosted, hosted)).toBe(false);
  });
});

describe('refusalOf', () => {
  it('reads a 409 event_concluded as concluded', () => {
    expect(refusalOf(problem('event_concluded'))).toEqual({ kind: 'concluded' });
  });

  it('reads a 403 plan_limit with its plan and limit', () => {
    expect(refusalOf(problem('plan_limit', { status: 403, plan: 'Free', limit: 3 }))).toEqual({
      kind: 'planLimit',
      plan: 'Free',
      limit: 3,
    });
  });

  it.each([new Error('offline'), problem('internal_error', { status: 500 })])(
    'reads anything else as failed',
    (error) => {
      expect(refusalOf(error)).toEqual({ kind: 'failed' });
    },
  );
});

describe('PHASE_WORD', () => {
  it('has a word for every declared phase, Happening now its own', () => {
    expect(Object.keys(PHASE_WORD).sort()).toEqual([...EVENT_PHASES].sort());
    expect(PHASE_WORD.happening_now).toBe('eventsScreen.happeningNow');
  });
});

describe('endRefusalOf', () => {
  it('reads a 409 event_state_invalid as changed elsewhere', () => {
    expect(endRefusalOf(problem('event_state_invalid'))).toEqual({ kind: 'changed' });
  });

  it('reads a 409 event_concluded as already over', () => {
    expect(endRefusalOf(problem('event_concluded'))).toEqual({ kind: 'concluded' });
  });

  it.each([new Error('offline'), problem('plan_limit', { status: 403 })])(
    'reads anything else as failed',
    (error) => {
      expect(endRefusalOf(error)).toEqual({ kind: 'failed' });
    },
  );
});

describe('pauseRefusalOf', () => {
  it('reads a 409 event_state_invalid as changed elsewhere', () => {
    expect(pauseRefusalOf(problem('event_state_invalid'))).toEqual({ kind: 'changed' });
  });

  it.each([
    new Error('offline'),
    problem('event_concluded'),
    problem('internal_error', { status: 500 }),
  ])('reads anything else as failed', (error) => {
    expect(pauseRefusalOf(error)).toEqual({ kind: 'failed' });
  });
});

describe('Make live’s alert (sc-48601)', () => {
  const t: Translate = (key: string, values?: Record<string, string | number>) =>
    values == null ? key : `${key} ${JSON.stringify(values)}`;
  const event = { name: 'Ada at 40', hosts: ['Bisi Akindele', 'Kola Mensah'] };
  const question: LiveQuestion = {
    kind: 'confirm',
    askHost: false,
    typed: '',
    error: null,
    notice: null,
    pending: false,
    failed: false,
  };

  it('opens makeLivePlanLimit on a 403 plan_limit, with its plan and limit and Close alone', () => {
    const told = toldOf(
      refusalOf(problem('plan_limit', { status: 403, plan: 'Pro', limit: 7 })),
      t,
    );

    expect(liveAlertOf(told, event, t, true)).toMatchObject({
      turn: 'told',
      title: 'eventLive.planLimit {"plan":"Pro","count":7}',
      line: 'eventLive.planLimitStays',
      alert: true,
      keep: { label: 'eventLive.close' },
      confirm: null,
    });
  });

  it('opens makeLiveEndPassed on event_concluded, with Change dates for somebody who can edit', () => {
    const told = toldOf(refusalOf(problem('event_concluded')), t);

    expect(liveAlertOf(told, event, t, true)).toMatchObject({
      title: 'eventLive.notMadeLive',
      line: 'eventLive.endPassed',
      confirm: { label: 'eventLive.changeDates' },
    });
    expect(liveAlertOf(told, event, t, false)?.confirm).toBeNull();
  });

  it('keeps a failure that is not a refusal in the question, as makeLiveNotMade', () => {
    expect(toldOf(refusalOf(new Error('offline')), t)).toBeNull();
    expect(liveAlertOf({ ...question, failed: true }, event, t, true)).toMatchObject({
      turn: 'question',
      failed: 'eventLive.failed',
      confirm: { label: 'eventLive.makeLive', busy: undefined },
    });
  });

  it('turns Make live and keeps Not yet waiting while it sends, as makeLiveMaking', () => {
    expect(liveAlertOf({ ...question, pending: true }, event, t, true)).toMatchObject({
      keep: { label: 'eventLive.notYet', off: true },
      confirm: { busy: 'eventLive.making' },
    });
  });

  it('asks for Host 1 with no host, and keeps what was typed when somebody else changed it', () => {
    expect(
      liveAlertOf({ ...question, askHost: true, notice: 'stillNoHost' }, event, t, true),
    ).toMatchObject({
      failed: 'eventEdit.changedElsewhere',
      host: { help: 'eventLive.hostExplainer', error: null },
      hostsNow: null,
    });
  });

  it('lists who hosts it now, one per line, once somebody else gave it a host', () => {
    expect(liveAlertOf({ ...question, notice: 'nowHosted' }, event, t, true)).toMatchObject({
      failed: 'eventLive.notSavedChanged',
      host: null,
      hostsNow: { line: 'eventLive.hostsNow', names: ['Bisi Akindele', 'Kola Mensah'] },
    });
  });
});
