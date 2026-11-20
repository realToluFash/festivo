import { describe, expect, it, vi } from 'vitest';

import {
  NOW_AT,
  SAMPLE_LINK,
  YOU,
  afterCopy,
  afterMark,
  afterReplace,
  copyIssued,
  trailLine,
} from './staffLink.ts';

const issued = () => Promise.resolve(SAMPLE_LINK);
const notIssued = () => Promise.reject(new Error('503'));

describe('a staff link’s row (sc-3912)', () => {
  it('says who did what, and when', () => {
    const trail = { by: YOU, at: '18:44' };
    expect(trailLine('copied', trail)).toBe('Copied by Amara Nwosu · 18:44 · not marked as sent');
    expect(trailLine('sent', trail)).toBe('Marked as sent by Amara Nwosu · 18:44');
    expect(trailLine('opened', { by: YOU, at: '19:05' })).toBe('Opened 19:05');
    expect(trailLine('shared', trail)).toBe('Shared by Amara Nwosu · 18:44 · not marked as sent');
    expect(trailLine('none', trail)).toBeNull();
  });

  it('copies No link yet and Copied to Copied by you, now', () => {
    expect(afterCopy('none', null)).toEqual({ link: 'copied', trail: { by: YOU, at: NOW_AT } });
    expect(afterCopy('copied', { by: 'Tobi', at: '17:00' }).trail).toEqual({ by: YOU, at: NOW_AT });
  });

  it('never moves Link sent or Link opened back to Copied', () => {
    const sent = { by: YOU, at: '18:44' };
    expect(afterCopy('sent', sent)).toEqual({ link: 'sent', trail: sent });
    expect(afterCopy('opened', sent)).toEqual({ link: 'opened', trail: sent });
  });

  it('marks as sent, and replaces back to No link yet', () => {
    expect(afterMark()).toEqual({ link: 'sent', trail: { by: YOU, at: NOW_AT } });
    expect(afterReplace()).toEqual({ link: 'none', trail: null });
  });
});

describe('Copy link’s write (sc-3912)', () => {
  it('says copied once the clipboard has the link', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    await expect(copyIssued(issued, { writeText }, null)).resolves.toEqual({
      kind: 'copied',
      url: SAMPLE_LINK,
    });
    expect(writeText).toHaveBeenCalledWith(SAMPLE_LINK);
  });

  it('starts the write inside the press where the browser takes a promised item', async () => {
    const write = vi.fn(() => Promise.resolve());
    const writeText = vi.fn(() => Promise.resolve());
    const item = {} as ClipboardItem;
    const outcome = await copyIssued(issued, { writeText, write }, () => item);
    expect(outcome.kind).toBe('copied');
    expect(write).toHaveBeenCalledWith([item]);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies nothing when no link is issued', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    await expect(copyIssued(notIssued, { writeText }, null)).resolves.toEqual({
      kind: 'notIssued',
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('hands back the issued link when the clipboard refuses it', async () => {
    const writeText = () => Promise.reject(new Error('NotAllowedError'));
    await expect(copyIssued(issued, { writeText }, null)).resolves.toEqual({
      kind: 'refused',
      url: SAMPLE_LINK,
    });
    await expect(copyIssued(issued, null, null)).resolves.toEqual({
      kind: 'refused',
      url: SAMPLE_LINK,
    });
  });
});
