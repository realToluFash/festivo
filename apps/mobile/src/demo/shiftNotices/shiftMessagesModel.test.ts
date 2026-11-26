import { describe, expect, it } from 'vitest';

import {
  CHANNELS,
  MESSAGE_KINDS,
  MY_SHIFT,
  SHIFT_MESSAGE_BOARDS,
  channelOf,
  messageKindOf,
  messageOf,
} from './shiftMessagesModel.ts';

const LINK = 'https://soirely.com/s/7Gk2pQ9xVb4mT1sR8nLw3c';

describe('a change to the shift (S2)', () => {
  it('pushes one line, expanded to one line per change', () => {
    expect(messageOf('start_time', 'push')).toMatchObject({
      title: 'Your shift has changed · Adaeze & Tunde’s wedding',
      lines: ['Your start time is now 15:00 (was 17:00).'],
      link: null,
      button: null,
    });
  });

  it('texts from the organisation, then the change lines, then the shift page link', () => {
    expect(messageOf('start_time', 'sms').text).toBe(
      `Ire Events: your shift at Adaeze & Tunde’s wedding on Saturday, Oct 17 has changed. Your start time is now 15:00 (was 17:00). Your shift page: ${LINK}`,
    );
  });

  it('names the new date when the date changed', () => {
    expect(messageOf('date', 'sms').text).toContain('on Sunday, Oct 18 has changed.');
    expect(messageOf('date', 'sms').text).toContain(
      'The date is now Sunday, Oct 18 (was Saturday, Oct 17).',
    );
  });

  it('puts several changes in the copy’s order, in one message', () => {
    expect(messageOf('several', 'push').lines).toEqual([
      'Your start time is now 15:00 (was 17:00).',
      'Your job is now Runner (was Waiter).',
      'The venue is now The Landmark (was Eko Hotel).',
    ]);
  });

  it('gives WhatsApp the same words with My shift in place of the link', () => {
    const wa = messageOf('job', 'whatsApp');

    expect(wa.button).toBe(MY_SHIFT);
    expect(wa.link).toBeNull();
    expect(wa.text).not.toContain('http');
    expect(messageOf('job', 'sms').text.startsWith(wa.text)).toBe(true);
  });
});

describe('a change to one of several shifts (S2)', () => {
  it('says a line per shift, in place of the start and end lines', () => {
    expect(messageOf('shift_added', 'push').lines).toEqual([
      '[You are now also on the shift from 18:00 to 23:00.]',
    ]);
    expect(messageOf('shift_off', 'push').lines).toEqual([
      '[You are no longer on the shift from 12:00 to 16:00.]',
    ]);
    expect(messageOf('shift_retimed', 'push').lines).toEqual([
      '[One of your shifts is now 18:00 to 23:30 (was 17:00 to 23:00).]',
    ]);
  });

  it('keeps the link when the last shift goes, and never reads as a removal', () => {
    const last = messageOf('last_shift_off', 'sms');

    expect(last.link).toBe(LINK);
    expect(last.text).toContain('[You have no shift at Adaeze & Tunde’s wedding for now.');
    expect(last.text).not.toContain('no longer on the staff');
    expect(messageOf('last_shift_off', 'whatsApp').button).toBe(MY_SHIFT);
  });
});

describe('the last message', () => {
  it('carries no link and no button on removal, call-off and End now', () => {
    for (const kind of ['removed', 'called_off', 'event_ended'] as const)
      for (const channel of CHANNELS) {
        const message = messageOf(kind, channel);
        expect(message.link).toBeNull();
        expect(message.button).toBeNull();
        expect(message.text).not.toContain('http');
      }
  });

  it('reads the copy’s words', () => {
    expect(messageOf('removed', 'sms').text).toBe(
      'Ire Events: you are no longer on the staff for Adaeze & Tunde’s wedding on Saturday, Oct 17.',
    );
    expect(messageOf('called_off', 'push')).toMatchObject({
      title: 'Your shift is called off · Adaeze & Tunde’s wedding',
      lines: ['The event on Saturday, Oct 17 will not go ahead. You do not need to come.'],
    });
    expect(messageOf('event_ended', 'sms').text).toBe(
      'Ire Events: Adaeze & Tunde’s wedding has ended, so your shift on Sunday, Oct 18 will not take place. You do not need to come.',
    );
  });
});

describe('the reminder the day before (S3)', () => {
  it('states its date, never tomorrow', () => {
    expect(messageOf('reminder', 'push')).toMatchObject({
      title: 'Your shift starts Saturday, Oct 17 at 17:00 · Adaeze & Tunde’s wedding',
      lines: ['Waiter at The Landmark.'],
    });
    expect(messageOf('reminder', 'sms').text).toBe(
      `Ire Events: your shift at Adaeze & Tunde’s wedding starts on Saturday, Oct 17 at 17:00, at The Landmark. Job: Waiter. Your shift page: ${LINK}`,
    );
    expect(messageOf('reminder', 'whatsApp').button).toBe(MY_SHIFT);
    for (const channel of CHANNELS)
      expect(JSON.stringify(messageOf('reminder', channel))).not.toMatch(/tomorrow/iu);
  });
});

describe('the boards', () => {
  it('links every kind on every channel, and push inside 24 hours', () => {
    expect(SHIFT_MESSAGE_BOARDS).toHaveLength(MESSAGE_KINDS.length * 4);
    for (const board of SHIFT_MESSAGE_BOARDS) {
      const params = new URLSearchParams(board.href.split('?')[1]);
      expect(messageKindOf(params.get('kind'))).toBe(params.get('kind'));
      expect(channelOf(params.get('channel'))).toBe(params.get('channel'));
    }
  });

  it('keeps English texts free of arrows and dashes', () => {
    for (const kind of MESSAGE_KINDS)
      for (const channel of CHANNELS)
        expect(JSON.stringify(messageOf(kind, channel))).not.toMatch(/[—–→]/u);
  });
});
