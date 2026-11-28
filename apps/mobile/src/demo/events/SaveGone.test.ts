import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { editOf, eventStateOf } from './EventsModel.ts';
import { W } from './EventsWords.ts';

const demo = readFileSync(join('src', 'demo', 'events', 'EventEdits.tsx'), 'utf8');
const slice = (from: string, to: string) => demo.slice(demo.indexOf(from), demo.indexOf(to));

describe('a part’s save refused 404 says the event is no longer available (sc-75689)', () => {
  it.each([
    ['nameGone', 'name'],
    ['replyByGone', 'replyBy'],
  ])('%s opens %s', (state, part) => {
    expect(editOf(eventStateOf(state))).toBe(part);
  });

  it('says nothing was changed, and offers no retry', () => {
    expect(W.eventGone).toBe('Nothing was changed. This event is no longer available.');
    expect(W.eventGone).not.toMatch(/try again/iu);
  });

  it.each([
    ['Event name', 'function NameEdit(', '/** The cover as it will show'],
    ['Reply by', 'function ReplyByEdit(', 'function draftOf('],
  ])('%s shows it where the role’s refusal shows, keeping what was typed', (_, from, to) => {
    const part = slice(from, to);

    expect(part).toContain('failed={gone ? W.eventGone : null}');
    expect(part).toMatch(/Gone'\) setGone\(true\);\s+else /u);
  });
});
