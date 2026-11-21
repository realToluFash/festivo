import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { EVENTS_PAGES, EVENT_WORDS as W, resetSample } from './events.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WEDDING = 'Adaeze & Tunde’s wedding';

async function page(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/evt-wed-4?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: WEDDING }, { timeout: 8000 });
}

const part = () => screen.getByRole('group', { name: W.cover });
const button = (name: string | RegExp) => within(part()).getByRole('button', { name });
const off = (name: string | RegExp) => button(name).getAttribute('aria-disabled') === 'true';
const fileInput = () => part().querySelector<HTMLInputElement>('input[type="file"]');

function choose(file: File) {
  const input = fileInput();
  if (input == null) throw new Error('no file input');
  fireEvent.change(input, { target: { files: [file] } });
}

function stubPhoto() {
  vi.stubGlobal(
    'URL',
    Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL() {} }),
  );
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 2400;
      naturalHeight = 1350;
      onload: (() => void) | null = null;
      set src(_: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  resetSample();
});

afterEach(() => vi.unstubAllGlobals());

describe('The cover edited in place, its states for sc-48606', () => {
  it('is linked from the demo home, the new states after the first three', () => {
    const states = EVENTS_PAGES.flatMap((one) => one.states)
      .map((one) => /state=(cover\w*)$/u.exec(one.to)?.[1])
      .filter((one) => one != null);

    expect(states).toEqual([
      'cover',
      'coverRefused',
      'coverPhoto',
      'coverUploading',
      'coverPhotoUploading',
      'coverChangeRefused',
      'coverSaveRefused',
    ]);
  });

  it('opens on an event with a photo with Save off, focus on Change photo', SLOW, async () => {
    await page('coverPhoto');

    expect(document.activeElement).toBe(button(W.changePhoto));
    expect(off(W.save)).toBe(true);
    fireEvent.change(within(part()).getByLabelText(/^Describe the image/u), {
      target: { value: 'The couple under the arch' },
    });
    expect(off(W.save)).toBe(false);
  });

  it('keeps the default cover while a file uploads, only the save waiting', SLOW, async () => {
    await page('coverUploading');

    expect(within(part()).getByRole('status').textContent).toBe(W.uploading);
    expect(part().querySelector('.ev-preview.is-photo')).toBeNull();
    expect(off(W.upload)).toBe(false);
    expect(off(W.cancel)).toBe(false);
    expect(off(W.save)).toBe(true);
  });

  it('keeps the earlier photo while a new one uploads, Change photo still on', SLOW, async () => {
    await page('coverPhotoUploading');

    expect(within(part()).getByRole('status').textContent).toBe(W.uploading);
    expect(part().querySelector('.ev-preview.is-photo')).not.toBeNull();
    expect(off(W.changePhoto)).toBe(false);
    expect(off(W.save)).toBe(true);
  });

  it('asks before Cancel drops an upload, and Discard closes the edit', SLOW, async () => {
    await page('coverUploading');

    fireEvent.click(button(W.cancel));
    const ask = screen.getByRole('alertdialog', { name: W.discardTitle });
    fireEvent.click(within(ask).getByRole('button', { name: W.discard }));
    expect(screen.queryByRole('group', { name: W.cover })).toBeNull();
  });

  it('keeps uploading when a file picked during the upload is refused', SLOW, async () => {
    await page('coverUploading');

    choose(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect((await within(part()).findByRole('alert')).textContent).toContain(W.refusedType);
    expect(within(part()).getByRole('status').textContent).toBe(W.uploading);
  });

  it('keeps the photo when Change photo is refused, and says why', SLOW, async () => {
    await page('coverChangeRefused');

    expect(within(part()).getByRole('alert').textContent).toContain(W.refusedType);
    expect(part().querySelector('.ev-preview.is-photo')).not.toBeNull();
    expect(off(W.changePhoto)).toBe(false);
    expect(off(W.save)).toBe(true);
  });

  it('keeps what was chosen when the server refuses the save', SLOW, async () => {
    await page('coverSaveRefused');

    expect(within(part()).getByRole('alert').textContent).toContain(W.uploadFailed);
    fireEvent.click(button(W.usePhoto));
    expect(part().querySelector('.ev-preview.is-photo')).not.toBeNull();
    expect(within(part()).getByRole('alert').textContent).toContain(W.uploadFailed);
  });

  it('refuses a file that is not a photo before it reaches the preview', SLOW, async () => {
    await page('cover');

    choose(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect((await within(part()).findByRole('alert')).textContent).toContain(W.refusedType);
    expect(part().querySelector('.ev-preview.is-photo')).toBeNull();
  });

  it('drops the upload when Remove photo is clicked during it', SLOW, async () => {
    stubPhoto();
    await page('coverPhoto');

    await act(async () => choose(new File(['x'], 'arch.jpg', { type: 'image/jpeg' })));
    expect(await within(part()).findByRole('status')).toBeDefined();
    fireEvent.click(button(W.removePhoto));
    expect(within(part()).queryByRole('status')).toBeNull();
    await act(() => new Promise((done) => setTimeout(done, 1800)));
    expect(part().querySelector('.ev-preview.is-photo')).toBeNull();
    expect(within(part()).queryByRole('status')).toBeNull();
  });

  it(
    'uploads a picked photo, a second pick replacing it, then Use this photo is on',
    SLOW,
    async () => {
      stubPhoto();
      await page('cover');

      await act(async () => choose(new File(['x'], 'arch.jpg', { type: 'image/jpeg' })));
      expect(await within(part()).findByRole('status')).toBeDefined();
      expect(part().querySelector('.ev-preview.is-photo')).toBeNull();
      await act(async () => choose(new File(['x'], 'arch-again.jpg', { type: 'image/jpeg' })));
      expect(within(part()).getByRole('status').textContent).toBe(W.uploading);
      expect(
        await within(part()).findByRole('button', { name: W.changePhoto }, { timeout: 4000 }),
      ).toBeDefined();
      expect(off(W.usePhoto)).toBe(false);
    },
  );
});
