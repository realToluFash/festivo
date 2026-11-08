import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { MESSAGES_BOARDS } from './MessagesBoards.ts';
import {
  type Messages,
  MESSAGES_STATES,
  draftLine,
  ended,
  isScheduled,
  messagesStateOf,
  reduce,
  sectionsOf,
  startOf,
} from './MessagesModel.ts';
import { SCHEDULED, SCHEDULED_BODY } from './MessagesSample.ts';
import { W } from './MessagesWords.ts';
import { SW, refusalLine } from './ScheduledSave.ts';

const REFUSED = ['editConflict', 'editSent', 'editCancelled', 'editTooLate'];
const TYPED = SCHEDULED_BODY.replace('17:30', '17:15');
const source = (file: string) => readFileSync(join(import.meta.dirname, file), 'utf8');
const opened = (state: string) => startOf(messagesStateOf(state), true);
const reloaded = (state: string) => reduce(opened(state), { type: 'reload' });
const where = (m: Messages) => {
  const sections = sectionsOf(m);
  const id = m.thread?.id;
  const has = (rows: typeof sections.done) =>
    rows.some((row) => row.kind === 'draft' && row.id === id);

  return has(sections.scheduled) ? 'scheduled' : has(sections.done) ? 'done' : 'elsewhere';
};

describe('sc-3963’s refused saves', () => {
  it('follow sc-3960’s states, each read from ?state= and linked from the demo home', () => {
    expect(MESSAGES_STATES.slice(54)).toEqual(REFUSED);
    for (const state of REFUSED) {
      expect(messagesStateOf(state)).toBe(state);
      expect(MESSAGES_BOARDS.find((board) => board.state === state)?.href).toBe(
        `/demo/events/evt-wed-4?area=messages&state=${state}`,
      );
    }
  });

  it('open on Edit with the typed words still in the box, the subject as it was', () => {
    for (const state of REFUSED)
      expect(opened(state)).toMatchObject({
        open: { kind: 'draft' },
        draft: {
          step: 'write',
          subject: SCHEDULED,
          body: TYPED,
          was: { subject: SCHEDULED, body: SCHEDULED_BODY },
        },
      });
  });

  it('say why in the first line, then that the text is still here, with Reload', () => {
    expect(REFUSED.map((state) => refusalLine(opened(state).refusedSave ?? 'conflict'))).toEqual([
      'Not saved. Bisi Okafor changed this message.',
      'Not saved. This message has already been sent.',
      'Not saved. This message has been cancelled.',
      'Not saved. This message was too late to send.',
    ]);
    expect(SW.textStillHere).toBe(
      'Your text is still here. Reload to see the message as it is now.',
    );
    expect(SW.reload).toBe('Reload');
  });

  it('refuse Save again, the typed words kept, until Reload', () => {
    const m = opened('editConflict');

    expect(reduce(m, { type: 'saveScheduled' })).toBe(m);
  });

  it('reload a colleague’s change as the message, still scheduled with its actions', () => {
    const m = reloaded('editConflict');

    expect(m.refusedSave).toBeUndefined();
    expect(m.draft).toMatchObject({ step: 'scheduled', was: null, subject: SCHEDULED });
    expect(m.draft?.body.endsWith('The doors open at 17:00.')).toBe(true);
    expect(m.draft != null && isScheduled(m.draft)).toBe(true);
    expect(where(m)).toBe('scheduled');
  });

  it('reload a message already sent as sent at 09:00, in Done', () => {
    const m = reloaded('editSent');

    expect(m.draft).toMatchObject({ step: 'sent', outcome: 'sent', time: '09:00' });
    expect(m.draft?.body).toBe(SCHEDULED_BODY);
    expect(where(m)).toBe('done');
  });

  it('reload a cancelled message as cancelled by Bisi Okafor, greyed in Done', () => {
    const m = reloaded('editCancelled');

    expect(m.draft).toMatchObject({ step: 'cancelled', cancelledBy: 'Bisi Okafor' });
    expect(m.draft == null ? '' : draftLine(m.draft)).toBe('Cancelled by Bisi Okafor at 09:46');
    expect(where(m)).toBe('done');
  });

  it('reload a message too late to send as Not sent: too late, with why, in Done', () => {
    const m = reloaded('editTooLate');

    expect(m.draft?.outcome).toBe('tooLate');
    expect(m.draft != null && ended(m.draft)).toBe(true);
    expect(W.tooLate).toBe('Not sent: too late');
    expect(SW.tooLateWhy).toBe(
      'The event was not resumed or restored within 48 hours of this message’s time.',
    );
    expect(where(m)).toBe('done');
  });

  it('is an alert with a red edge and the mark, said at once, and takes focus so the keys go down', () => {
    const alert = source('RefusedSave.tsx');
    const screen = source('MessagesScreen.tsx');

    expect(alert).toContain('accessibilityRole="alert"');
    expect(alert).toContain('<Glyph name="alert"');
    expect(alert).toContain('borderColor: tokens.colorBroken');
    expect(screen).toMatch(
      /Keyboard\.dismiss\(\);\s*readOut\([^;]*\{ interrupts: true \}\);[\s\S]*moveScreenReaderFocus\(refs\.current\.refused/u,
    );
  });
});
