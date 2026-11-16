import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { ApiError } from '@soirely/api-client';
import { eventFormErrors, firstRefusedOf } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';

import { blankEvent, coverAfterCreate, sendOutcome } from '../kit/eventForm.ts';

const t = ((key: string) => key) as unknown as TFunction;
const screen = readFileSync(join('src', 'components', 'NewEvent.tsx'), 'utf8');
const send = screen.slice(
  screen.indexOf('async function send('),
  screen.indexOf('const pickStart'),
);

function refusal(violations: { propertyPath: string; message: string; code: string }[]): ApiError {
  const problem = {
    type: 'https://soirely.com/errors/validation_failed',
    title: 'No.',
    status: 422,
    violations,
  };

  return new ApiError(problem, new Response(JSON.stringify(problem), { status: 422 }));
}

describe("the app's New event refuses on its fields (sc-48607)", () => {
  it('focuses Event name when a blank event is sent', () => {
    const blank = blankEvent({ timezone: 'Africa/Lagos', currency: 'NGN' });
    const found = eventFormErrors(blank, t);

    expect(firstRefusedOf(found, {}, blank.hosts)).toEqual({ field: 'name' });
    expect(send).toMatch(/const found = eventFormErrors\(typed, t\);[\s\S]*refuse\(\s*found,/u);
  });

  it('lands a 422 on the time zone under Time zone', () => {
    const outcome = sendOutcome(
      refusal([{ propertyPath: 'timeZone', message: 'Pick a real zone.', code: 'x' }]),
      t,
    );

    expect(outcome).toEqual({ kind: 'refused', errors: { timeZone: 'Pick a real zone.' } });
    expect(send).toContain('refuse(outcome.errors, outcome.hosts);');
    expect(screen).toContain('error={errors.timeZone ?? null}');
  });

  it('hands the created draft’s id to onCreated once its cover is settled', () => {
    expect(send).toMatch(
      /const created = await api\.createEvent\([\s\S]*await coverAfterCreate\([\s\S]*onCreated\(created\.id\);/u,
    );
  });
});

describe("the app's New event cover, after the event exists (sc-48607)", () => {
  it('says on the event page a photo whose upload failed after Create event was tapped', async () => {
    const attach = vi.fn(() => Promise.resolve());
    const refuse = vi.fn();

    await coverAfterCreate({ refused: 'The photo did not upload.' }, attach, refuse, () => 'x');

    expect(attach).not.toHaveBeenCalled();
    expect(refuse).toHaveBeenCalledWith('The photo did not upload.');
  });

  it('attaches an uploaded photo, and says a refused attach on the page', async () => {
    const attach = vi.fn(() => Promise.reject(new Error('no')));
    const refuse = vi.fn();

    await coverAfterCreate({ key: 'k1' }, attach, refuse, () => 'Refused.');

    expect(attach).toHaveBeenCalledWith('k1');
    expect(refuse).toHaveBeenCalledWith('Refused.');
  });

  it('says nothing of a photo removed before its upload finished', async () => {
    const attach = vi.fn(() => Promise.resolve());
    const refuse = vi.fn();

    await coverAfterCreate(null, attach, refuse, () => 'x');

    expect(attach).not.toHaveBeenCalled();
    expect(refuse).not.toHaveBeenCalled();
  });
});
