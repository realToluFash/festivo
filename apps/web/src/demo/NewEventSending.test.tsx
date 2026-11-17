import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { EVENT_WORDS as W } from './events.ts';
import { sentForCopy } from './newEvent.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const HEIC = () => new File(['x'], 'arch.heic', { type: 'image/heic' });
const JPEG = () => new File(['x'], 'arch.jpg', { type: 'image/jpeg' });

function open(state?: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/events/new${state == null ? '' : `?state=${state}`}`],
  });
  render(<RouterProvider router={router} />);

  return router;
}

const cover = () => screen.getByRole('region', { name: W.coverPhoto });
const waiting = () => within(cover()).queryByRole('status');
const ready = () => screen.findByRole('textbox', { name: /Event name/ });
const later = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));

function choose(file: File) {
  const input = cover().querySelector<HTMLInputElement>('input[type="file"]');
  if (input == null) throw new Error('no file input');
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  __setConfig({ ...tested, environment: 'development' });
  vi.useFakeTimers({ shouldAdvanceTime: true });
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
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('New event with a HEIC still on its way (sc-60915)', () => {
  it('takes a HEIC by its type or its name as one the server copies', () => {
    expect(sentForCopy(HEIC())).toBe(true);
    expect(sentForCopy(new File(['x'], 'IMG_0042.HEIF', { type: '' }))).toBe(true);
    expect(sentForCopy(JPEG())).toBe(false);
  });

  it('keeps the default cover with Uploading…, Change photo and Remove photo', SLOW, async () => {
    open('photoSending');
    await ready();

    expect(waiting()?.textContent).toBe(W.uploading);
    expect(cover().querySelector('.ev-preview.is-photo')).toBeNull();
    expect(within(cover()).getByRole('button', { name: W.changePhoto })).toBeDefined();
    expect(within(cover()).getByRole('button', { name: W.removePhoto })).toBeDefined();
    expect(within(cover()).queryByRole('button', { name: W.upload })).toBeNull();
  });

  it('places the copy once it lands, with today’s photo fields', SLOW, async () => {
    open();
    await ready();

    choose(HEIC());
    expect(await within(cover()).findByRole('status')).toBeDefined();
    await later(3100);

    expect(waiting()).toBeNull();
    expect(cover().querySelector('.ev-preview.is-photo')).not.toBeNull();
    expect(within(cover()).getByRole('button', { name: W.changePhoto })).toBeDefined();
    expect(within(cover()).getByRole('slider', { name: W.position })).toBeDefined();
    expect(within(cover()).getByRole('textbox', { name: /Describe the image/u })).toBeDefined();
    expect(within(cover()).getByRole('button', { name: W.removePhoto })).toBeDefined();
  });

  it('holds Creating… until the copy lands, then opens the event', SLOW, async () => {
    const router = open('photoSending');
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDefined();
    expect(within(cover()).getByRole('button', { name: W.changePhoto })).toHaveProperty(
      'disabled',
      true,
    );
    expect(within(cover()).queryByRole('button', { name: W.removePhoto })).toBeNull();
    await later(2900);
    expect(router.state.location.pathname).toBe('/demo/events/new');
    expect(waiting()?.textContent).toBe(W.uploading);

    await later(200);
    await later(1300);
    expect(screen.getByText('Created. Opening the event.')).toBeDefined();
    await later(1700);
    expect(router.state.location.pathname).toBe('/demo/events/evt-draft-4');
    expect(router.state.location.state).toBeNull();
  });

  it('stays on Creating… while the copy is held', SLOW, async () => {
    const router = open('photoSendingCreating');
    await ready();

    await later(8000);
    expect(screen.getByRole('button', { name: 'Creating…' })).toBeDefined();
    expect(waiting()?.textContent).toBe(W.uploading);
    expect(router.state.location.pathname).toBe('/demo/events/new');
  });

  it('opens the event without its photo when the copy fails after Create', SLOW, async () => {
    const router = open('photoSendLost');
    await ready();

    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    await later(3100);
    await later(1300);
    await later(1700);

    expect(router.state.location.pathname).toBe('/demo/events/evt-draft-4');
    expect(
      await screen.findByText(`The event is saved without its photo. ${W.uploadFailed}`),
    ).toBeDefined();
  });

  it('says a copy that failed before Create in the block, on the default cover', async () => {
    open('photoSendFailed');
    await ready();

    expect(within(cover()).getByText(W.uploadFailed)).toBeDefined();
    expect(within(cover()).getByRole('button', { name: W.upload })).toBeDefined();
    expect(waiting()).toBeNull();
  });

  it('gives the frame to the last photo picked, never an earlier copy', SLOW, async () => {
    open();
    await ready();

    choose(HEIC());
    await within(cover()).findByRole('status');
    await later(1000);
    choose(JPEG());
    await within(cover()).findByRole('slider', { name: W.position });
    fireEvent.click(within(cover()).getByRole('button', { name: W.removePhoto }));
    await later(3000);

    expect(cover().querySelector('.ev-preview.is-photo')).toBeNull();
    expect(within(cover()).getByRole('button', { name: W.upload })).toBeDefined();
  });

  it('drops the copy when Remove photo is pressed during the wait', SLOW, async () => {
    open('photoSending');
    await ready();

    fireEvent.click(within(cover()).getByRole('button', { name: W.removePhoto }));
    expect(waiting()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    await later(3100);

    expect(cover().querySelector('.ev-preview.is-photo')).toBeNull();
  });

  it('asks before leaving when the photo on its way is the only change', SLOW, async () => {
    vi.useRealTimers();
    const router = open();
    await ready();

    choose(HEIC());
    await within(cover()).findByRole('status');
    await act(async () => new Promise((done) => setTimeout(done, 50)));
    const crumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    fireEvent.click(within(crumb).getByRole('link', { name: 'Events' }));
    expect(router.state.location.pathname).toBe('/demo/events/new');

    expect(await screen.findByText('What you typed for this event will be lost.')).toBeDefined();
  });
});
