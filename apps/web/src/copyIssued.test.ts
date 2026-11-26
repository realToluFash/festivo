import { describe, expect, it, vi } from 'vitest';

import { copyIssued } from './copyIssued.ts';

const SAMPLE_LINK = 'https://soirely.com/w/7Gk2pQ9xVb4mT1sR8nLw3c';
const issued = () => Promise.resolve(SAMPLE_LINK);
const notIssued = () => Promise.reject(new Error('503'));

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
