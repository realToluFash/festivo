import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connection } from '@soirely/domain';

import { api } from '../../../api.ts';
import { type CoverUse, CoverSection } from './CoverSection.tsx';
import type { CoverPhoto } from './EventCoverImage.tsx';

type Answer = (body: unknown, url: URL) => Response | Promise<Response>;
type Sent = { line: string; body: unknown }[];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ETag: '"1"' } });
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status, ...extra },
    status,
  );
}

let held: { cover: CoverPhoto | null; sent: Sent } = { cover: null, sent: [] };

function holding(cover: unknown, sent: Sent): void {
  held = { cover: cover as CoverPhoto | null, sent };
}

/** New event's Cover section as New event holds it: Use this photo stages the photo, Remove photo drops it; each is written to `sent` as `use /cover` and `remove /cover`. */
function NewEventCover() {
  const [photo, setPhoto] = useState(held.cover);

  return (
    <CoverSection
      type="wedding"
      photo={photo}
      organisationId="org_1"
      onUse={async ({ upload, position, description }: CoverUse) => {
        held.sent.push({
          line: 'use /cover',
          body: { ...(upload == null ? {} : { uploadKey: upload.key }), position, description },
        });
        const sizes = upload?.preview.sizes ?? photo?.sizes;
        if (sizes != null) setPhoto({ sizes, position, description });
      }}
      onRemove={async () => {
        held.sent.push({ line: 'remove /cover', body: null });
        setPhoto(null);
      }}
    />
  );
}

async function editingCover(): Promise<void> {
  render(<NewEventCover />);
  await screen.findByRole('heading', { level: 2, name: 'Cover' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('The cover (sc-3590)', () => {
  const PHOTO = {
    position: 30,
    description: 'Adaeze and Tunde under the arch',
    sizes: [
      { width: 640, url: 'http://store.test/c/small.webp' },
      { width: 1280, url: 'http://store.test/c/medium.webp' },
      { width: 1920, url: 'http://store.test/c/large.webp' },
    ],
  };
  let nextImage: { width: number; height: number } | null = { width: 2400, height: 1600 };

  function serving(cover: unknown, answers: Record<string, Answer> = {}) {
    const sent: { line: string; body: unknown }[] = [];
    holding(cover, sent);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line, body });

      const answer = await answers[line]?.(body, new URL(String(input)));
      if (answer != null) return answer;
      if (line === 'POST /api/orgs/org_1/event-cover-uploads')
        return json(
          {
            upload: {
              url: 'http://store.test/upload/1',
              key: 'event_cover/org_1/2026/10/one.jpg',
              content_type: 'image/jpeg',
            },
          },
          201,
        );
      if (line === 'PUT /upload/1') return new Response(null, { status: 200 });
      if (line === 'POST /api/orgs/org_1/event-cover-uploads/preview')
        return json({ preview: 'data:image/webp;base64,UklGRg==' });

      return json({});
    });

    return sent;
  }

  function file(name = 'arch.jpg', type = 'image/jpeg', size = 1000): File {
    const chosen = new File(['x'], name, { type });
    Object.defineProperty(chosen, 'size', { value: size });

    return chosen;
  }

  function choose(chosen: File): void {
    fireEvent.change(document.getElementById('cover-file')!, { target: { files: [chosen] } });
  }

  async function editing(): Promise<void> {
    await editingCover();
  }

  beforeEach(() => {
    nextImage = { width: 2400, height: 1600 };
    URL.createObjectURL = () => 'blob:chosen';
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 0;
        naturalHeight = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => {
            if (nextImage == null) return this.onerror?.();
            this.naturalWidth = nextImage.width;
            this.naturalHeight = nextImage.height;
            this.onload?.();
          });
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [
      'a GIF',
      'a.gif',
      'image/gif',
      1000,
      'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.',
    ],
    [
      'over 15 MB',
      'a.jpg',
      'image/jpeg',
      15 * 1024 * 1024 + 1,
      'That photo is over 15 MB. Choose a smaller one.',
    ],
  ])(
    'refuses %s before it uploads, saying which and what is accepted',
    async (_, name, type, size, line) => {
      const sent = serving(null);
      await editing();
      const chosen = file(name, type, size);

      choose(chosen);

      expect(await screen.findByText(line)).toBeDefined();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(sent.filter(({ line: sentLine }) => sentLine.includes('cover'))).toEqual([]);
    },
  );

  it('refuses a photo smaller than 1200 × 675 before it uploads', async () => {
    const sent = serving(null);
    await editing();
    nextImage = { width: 1199, height: 900 };

    choose(file());

    expect(
      await screen.findByText(
        'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
      ),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.includes('cover'))).toEqual([]);
  });

  it('uploads a chosen photo in the dialog, and Use this photo saves it, its position and its description', async () => {
    const sent = serving(null);
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    const slider = within(dialog).getByLabelText('Photo position');

    await waitFor(() => expect(document.activeElement).toBe(slider));
    expect(within(dialog).queryByRole('button', { name: 'Remove photo' })).toBeNull();
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));

    fireEvent.change(slider, { target: { value: '80' } });
    expect(slider.getAttribute('aria-valuetext')).toBe('Showing the bottom of the photo');
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: ' The arch ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    const cover = await screen.findByRole('button', { name: 'Change photo' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent.find(({ line }) => line === 'use /cover')?.body).toEqual({
      uploadKey: 'event_cover/org_1/2026/10/one.jpg',
      position: 80,
      description: 'The arch',
    });
    expect(within(cover).getByRole('img').getAttribute('alt')).toBe('The arch');
    await waitFor(() => expect(document.activeElement).toBe(cover));
  });

  it('Cancel and Escape save nothing from the visit and keep the previous cover, and focus goes back to the cover', async () => {
    const sent = serving(PHOTO);
    await editing();
    const cover = screen.getByRole('button', { name: 'Change photo' });

    for (const leave of ['Cancel', 'Escape']) {
      fireEvent.click(cover);
      const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
      fireEvent.change(within(dialog).getByLabelText('Photo position'), {
        target: { value: '90' },
      });
      fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
        target: { value: 'Something else' },
      });

      if (leave === 'Cancel')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      else fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const img = within(screen.getByRole('button', { name: 'Change photo' })).getByRole('img');
      expect(img.getAttribute('alt')).toBe(PHOTO.description);
      expect(img.style.objectPosition).toBe('50% 30%');
      await waitFor(() => expect(document.activeElement).toBe(cover));
    }

    expect(sent.filter(({ line }) => line.includes('/cover'))).toEqual([]);
  });

  it('a new photo chosen and then cancelled is discarded, and the previous cover stays', async () => {
    const sent = serving(PHOTO);
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
    ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/one.jpg' });
    expect(
      within(screen.getByRole('button', { name: 'Change photo' }))
        .getByRole('img')
        .getAttribute('src'),
    ).toBe(PHOTO.sizes[0]!.url);
    expect(sent.filter(({ line }) => line === 'use /cover')).toEqual([]);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Upload a photo' })),
    );
  });

  it('a photo still uploading when the dialog closes is discarded once it arrives', async () => {
    let arrive = (): void => undefined;
    const sent = serving(PHOTO, {
      'PUT /upload/1': () =>
        new Promise<Response>((resolve) => {
          arrive = () => resolve(new Response(null, { status: 200 }));
        }),
    });
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(dialog.isConnected).toBe(false);
    arrive();

    await waitFor(() =>
      expect(
        sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
      ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/one.jpg' }),
    );
  });

  it('Remove photo is there when a saved photo is being replaced through Upload a photo', async () => {
    serving(PHOTO);
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(within(dialog).getByRole('button', { name: 'Remove photo' })).toBeDefined();
  });

  it('Remove photo brings back the default, says so, and focus goes to Upload a photo', async () => {
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove photo' }));

    expect(await screen.findByText('Photo removed. The default cover is back.')).toBeDefined();
    expect(screen.queryByText(/The default cover for this type of event/)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('cover-default').className).toContain('cover-default-wedding');
    expect(sent.map(({ line }) => line)).toContain('remove /cover');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Upload a photo' }));
  });

  it('an upload that fails says so, the frame keeps the saved cover, and Cancel saves nothing', async () => {
    const sent = serving(PHOTO, { 'PUT /upload/1': () => new Response(null, { status: 500 }) });
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDefined();
    expect(sent.filter(({ line }) => line === 'use /cover')).toEqual([]);
  });

  it('refuses a description over 250 characters and saves nothing', async () => {
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'a'.repeat(251) },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    expect(
      within(dialog).getByText('Shorten the description to 250 characters or fewer.'),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.includes('/cover'))).toEqual([]);
  });
});

describe('A HEIC the browser cannot show, and a cover that will not load (sc-13861)', () => {
  const PHOTO = {
    position: 30,
    description: 'Adaeze and Tunde under the arch',
    sizes: [
      { width: 640, url: 'http://store.test/c/small.webp' },
      { width: 1280, url: 'http://store.test/c/medium.webp' },
    ],
  };
  const COPY = 'data:image/webp;base64,UklGRg==';
  const PREVIEW = 'POST /api/orgs/org_1/event-cover-uploads/preview';

  function refusedWith(message: string): Answer {
    return () =>
      problem(422, 'validation_failed', {
        violations: [{ propertyPath: 'file', message, code: 'validation_failed' }],
      });
  }

  function serving(cover: unknown, answers: Record<string, Answer> = {}) {
    const sent: { line: string; body: unknown }[] = [];
    holding(cover, sent);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line, body });

      const answer = await answers[line]?.(body, new URL(String(input)));
      if (answer != null) return answer;
      if (line === 'POST /api/orgs/org_1/event-cover-uploads')
        return json(
          {
            upload: {
              url: 'http://store.test/upload/1',
              key: 'event_cover/org_1/2026/10/one.heic',
              content_type: 'image/heic',
            },
          },
          201,
        );
      if (line === 'PUT /upload/1') return new Response(null, { status: 200 });
      if (line === PREVIEW) return json({ preview: COPY });
      if (line === 'DELETE /api/orgs/org_1/event-cover-uploads')
        return new Response(null, { status: 204 });

      return json({});
    });

    return sent;
  }

  function chooseHeic(): void {
    fireEvent.change(document.getElementById('cover-file')!, {
      target: { files: [new File(['x'], 'IMG_0412.HEIC', { type: '' })] },
    });
  }

  async function editing(): Promise<void> {
    await editingCover();
  }

  beforeEach(() => {
    URL.createObjectURL = () => 'blob:chosen';
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the server's copy in the frame after Uploading…, and saves the HEIC itself", async () => {
    let release: (() => void) | null = null;
    const sent = serving(null, {
      [PREVIEW]: () =>
        new Promise((resolve) => {
          release = () => resolve(json({ preview: COPY }));
        }),
    });
    await editing();

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(release).not.toBeNull());

    expect(within(dialog).getByText('Uploading…')).toBeDefined();
    release!();
    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(COPY),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(sent.find(({ line }) => line === PREVIEW)?.body).toEqual({
      uploadKey: 'event_cover/org_1/2026/10/one.heic',
    });

    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '70' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    const cover = await screen.findByRole('button', { name: 'Change photo' });
    expect(cover.querySelector('img')?.getAttribute('src')).toBe(COPY);
    expect(sent.find(({ line }) => line === 'use /cover')?.body).toEqual({
      uploadKey: 'event_cover/org_1/2026/10/one.heic',
      position: 70,
      description: null,
    });
  });

  function chooseShownJpeg(): void {
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    fireEvent.change(document.getElementById('cover-file')!, {
      target: { files: [new File(['x'], 'arch.jpg', { type: 'image/jpeg' })] },
    });
  }

  it("a JPEG the browser shows is read by the server too, and the frame keeps the browser's own", async () => {
    const sent = serving(null);
    await editing();

    chooseShownJpeg();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    await waitFor(() => expect(sent.map(({ line }) => line)).toContain(PREVIEW));
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:chosen');
    expect(
      within(dialog).getByRole('button', { name: 'Use this photo' }).getAttribute('aria-disabled'),
    ).not.toBe('true');
  });

  it('a damaged JPEG whose size the browser reads is refused while Cover photo is open, and nothing is saved (27 Oct)', async () => {
    const line = 'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.';
    const sent = serving(PHOTO, { [PREVIEW]: refusedWith(line) });
    await editing();

    chooseShownJpeg();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText(line)).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDefined();
    expect(sent.filter(({ line: sentLine }) => sentLine.startsWith('PUT /api/events'))).toEqual([]);
  });

  for (const [what, line] of [
    [
      'smaller than 1200 × 675',
      'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
    ],
    [
      'not a readable photo',
      'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.',
    ],
  ] as const) {
    it(`a HEIC ${what} is refused while Cover photo is open, and nothing is saved`, async () => {
      const sent = serving(PHOTO, { [PREVIEW]: refusedWith(line) });
      await editing();

      chooseHeic();
      const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

      expect(await within(dialog).findByText(line)).toBeDefined();
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(
        PHOTO.sizes[0]!.url,
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(sent.filter(({ line: sentLine }) => sentLine.startsWith('PUT /api/events'))).toEqual(
        [],
      );
    });
  }

  it('a copy that cannot be made is never saved unseen: the upload failed, and Cancel keeps the cover', async () => {
    const sent = serving(PHOTO, { [PREVIEW]: () => new Response(null, { status: 502 }) });
    await editing();

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDefined();
    await waitFor(() =>
      expect(
        sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
      ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/one.heic' }),
    );
    expect(sent.filter(({ line }) => line === 'use /cover')).toEqual([]);
  });

  it('a copy the frame then cannot show is never saved unseen either', async () => {
    const sent = serving(null);
    await editing();

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(dialog.querySelector('.cover-frame img')).not.toBeNull());
    fireEvent.error(dialog.querySelector('.cover-frame img')!);

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(dialog.querySelector('.cover-frame')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Choose a photo' })).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));
    expect(sent.filter(({ line }) => line === 'use /cover')).toEqual([]);
  });

  it('a file named .jpg that is not a readable photo is refused while Cover photo is open', async () => {
    const line = 'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.';
    const sent = serving(PHOTO, { [PREVIEW]: refusedWith(line) });
    await editing();

    fireEvent.change(document.getElementById('cover-file')!, {
      target: { files: [new File(['x'], 'arch.jpg', { type: 'image/jpeg' })] },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText(line)).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent.filter(({ line: sentLine }) => sentLine.startsWith('PUT /api/events'))).toEqual([]);
  });

  it('while a HEIC uploads the frame holds the default, not the saved cover, and nothing can be positioned', async () => {
    let release: (() => void) | null = null;
    serving(PHOTO, {
      [PREVIEW]: () =>
        new Promise((resolve) => {
          release = () => resolve(json({ preview: COPY }));
        }),
    });
    await editing();

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(release).not.toBeNull());

    expect(within(dialog).getByText('Uploading…')).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')).toBeNull();
    expect(dialog.querySelector('.cover-frame .cover-default-wedding')).not.toBeNull();
    const slider = within(dialog).getByLabelText('Photo position');
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(slider, { target: { value: '80' } });
    expect((slider as HTMLInputElement).value).toBe('50');
    expect(within(dialog).queryByRole('alert')).toBeNull();

    release!();

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(COPY),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(slider.getAttribute('aria-disabled')).toBe('false');
  });

  it('a saved photo that fails to load shows the default in the Cover section and the Cover photo frame', async () => {
    serving({ ...PHOTO });
    await editing();

    const cover = screen.getByRole('button', { name: 'Change photo' });
    fireEvent.error(within(cover).getByRole('img'));
    expect(within(cover).queryByRole('img')).toBeNull();
    expect(cover.querySelector('.cover-default-wedding')).not.toBeNull();

    fireEvent.click(cover);
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.error(dialog.querySelector('.cover-frame img')!);

    expect(dialog.querySelector('.cover-frame .cover-default-wedding')).not.toBeNull();
    expect(within(dialog).queryByText('The photo did not upload. Try again.')).toBeNull();
  });
});

describe('Cover photo chooses its own photo, and a refused one never reaches the frame (sc-16524)', () => {
  const PHOTO = {
    position: 30,
    description: 'Adaeze and Tunde under the arch',
    sizes: [
      { width: 640, url: 'http://store.test/c/small.webp' },
      { width: 1280, url: 'http://store.test/c/medium.webp' },
    ],
  };
  const DAMAGED = 'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.';

  function serving(cover: unknown) {
    const sent: { line: string; body: unknown }[] = [];
    holding(cover, sent);
    let uploads = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line, body });

      if (line === 'POST /api/orgs/org_1/event-cover-uploads') {
        uploads += 1;
        return json(
          {
            upload: {
              url: `http://store.test/upload/${uploads}`,
              key: `event_cover/org_1/2026/10/${(body as { filename: string }).filename}`,
              content_type: 'image/jpeg',
            },
          },
          201,
        );
      }
      if (line.startsWith('PUT /upload/')) return new Response(null, { status: 200 });
      if (line === 'POST /api/orgs/org_1/event-cover-uploads/preview')
        return (body as { uploadKey: string }).uploadKey.includes('damaged')
          ? problem(422, 'validation_failed', {
              violations: [{ propertyPath: 'file', message: DAMAGED, code: 'validation_failed' }],
            })
          : json({ preview: 'data:image/webp;base64,UklGRg==' });
      if (line === 'DELETE /api/orgs/org_1/event-cover-uploads')
        return new Response(null, { status: 204 });

      return json({});
    });

    return sent;
  }

  function jpeg(name: string, type = 'image/jpeg'): File {
    return new File(['x'], name, { type });
  }

  function upload(chosen: File): void {
    fireEvent.change(document.getElementById('cover-file')!, { target: { files: [chosen] } });
  }

  function pickInDialog(chosen: File): void {
    fireEvent.change(document.getElementById('cover-dialog-file')!, {
      target: { files: [chosen] },
    });
  }

  function frameSource(dialog: HTMLElement): string | null | undefined {
    return dialog.querySelector('.cover-frame img')?.getAttribute('src');
  }

  async function editing(): Promise<void> {
    await editingCover();
  }

  beforeEach(() => {
    URL.createObjectURL = (chosen: Blob) => `blob:${(chosen as File).name}`;
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a refused pick keeps the photo chosen earlier in the visit, at its position, and Use this photo saves that one', async () => {
    const sent = serving(null);
    await editing();

    upload(jpeg('arch.jpg'));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '80' } });
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'The arch' },
    });

    pickInDialog(jpeg('damaged.jpg'));
    const picker = within(dialog).getByRole('button', { name: 'Choose another photo' });

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(frameSource(dialog)).toBe('blob:arch.jpg');
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('80');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      'The arch',
    );
    await waitFor(() => expect(document.activeElement).toBe(picker));
    expect(picker.getAttribute('aria-describedby')).toContain('cover-dialog-refusal');
    expect(document.getElementById('cover-refusal')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'use /cover')?.body).toEqual({
        uploadKey: 'event_cover/org_1/2026/10/arch.jpg',
        position: 80,
        description: 'The arch',
      }),
    );
    expect(
      sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
    ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/damaged.jpg' });
  });

  it('a refused pick from the cover keeps the saved photo at its saved position, and Use this photo saves it as shown', async () => {
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    pickInDialog(jpeg('damaged.jpg'));

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('alt')).toBe(PHOTO.description);
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('30');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      PHOTO.description,
    );
    expect(within(dialog).getByRole('button', { name: 'Remove photo' })).toBeDefined();

    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '60' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'use /cover')?.body).toEqual({
        position: 60,
        description: PHOTO.description,
      }),
    );
  });

  it('a refused pick from Upload a photo with a photo saved shows the saved photo, and Cancel keeps the saved cover', async () => {
    const sent = serving(PHOTO);
    await editing();

    upload(jpeg('damaged.jpg'));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      PHOTO.description,
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const img = within(screen.getByRole('button', { name: 'Change photo' })).getByRole('img');
    expect(img.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    expect(img.style.objectPosition).toBe('50% 30%');
    expect(sent.filter(({ line }) => line === 'use /cover')).toEqual([]);
  });

  it('a refused first pick leaves Choose a photo, with nothing to position or describe and nothing to use', async () => {
    const sent = serving(null);
    await editing();

    upload(jpeg('damaged.jpg'));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    const choose = await within(dialog).findByRole('button', { name: 'Choose a photo' });

    expect(within(dialog).getByText(DAMAGED)).toBeDefined();
    expect(dialog.querySelector('.cover-frame')).toBeNull();
    expect(dialog.querySelector('[data-testid="cover-default"]')).toBeNull();
    expect(
      within(dialog).getByText('JPEG, PNG, WebP or HEIC, up to 15 MB, at least 1200 × 675 pixels.'),
    ).toBeDefined();
    expect(within(dialog).queryByLabelText('Photo position')).toBeNull();
    expect(within(dialog).queryByLabelText(/Describe the image/)).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Remove photo' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(choose));
    expect(choose.getAttribute('aria-describedby')).toBe(
      'cover-dialog-refusal cover-dialog-accepted',
    );
    const use = within(dialog).getByRole('button', { name: 'Use this photo' });
    expect(use.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(use);
    expect(sent.filter(({ line }) => line === 'use /cover')).toEqual([]);
  });

  it('a good pick after a refusal clears it, fills the frame at the middle with no description, and focus goes to Photo position', async () => {
    serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    pickInDialog(jpeg('damaged.jpg'));
    await within(dialog).findByText(DAMAGED);

    pickInDialog(jpeg('garden.jpg'));

    await waitFor(() => expect(frameSource(dialog)).toBe('blob:garden.jpg'));
    expect(within(dialog).queryByText(DAMAGED)).toBeNull();
    const slider = within(dialog).getByLabelText('Photo position') as HTMLInputElement;
    expect(slider.value).toBe('50');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      '',
    );
    await waitFor(() => expect(document.activeElement).toBe(slider));
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    expect(
      within(dialog)
        .getByRole('button', { name: 'Choose another photo' })
        .getAttribute('aria-describedby'),
    ).toBeNull();
  });

  it('a photo the frame cannot show keeps the position and description given the saved photo in this visit, as a refusal from the server does', async () => {
    serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '70' } });
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'The terrace at dusk' },
    });

    pickInDialog(jpeg('b.jpg'));
    await waitFor(() => expect(frameSource(dialog)).toBe('blob:b.jpg'));
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    fireEvent.error(dialog.querySelector('.cover-frame img')!);

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('70');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      'The terrace at dusk',
    );
  });

  it('a photo the frame cannot show gives back the one chosen earlier in this visit, and Use this photo saves that one', async () => {
    const sent = serving(null);
    await editing();

    upload(jpeg('a.jpg'));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '80' } });

    pickInDialog(jpeg('b.jpg'));
    await waitFor(() => expect(frameSource(dialog)).toBe('blob:b.jpg'));
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    fireEvent.error(dialog.querySelector('.cover-frame img')!);

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(frameSource(dialog)).toBe('blob:a.jpg');
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('80');
    expect(
      sent
        .filter(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')
        .map(({ body }) => body),
    ).toEqual([{ uploadKey: 'event_cover/org_1/2026/10/b.jpg' }]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'use /cover')?.body).toEqual({
        uploadKey: 'event_cover/org_1/2026/10/a.jpg',
        position: 80,
        description: null,
      }),
    );
  });

  it('a refusal from the server keeps the position and description given the saved photo in this visit, as one before upload does', async () => {
    serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '70' } });
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'The terrace at dusk' },
    });

    pickInDialog(jpeg('damaged.jpg'));

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('70');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      'The terrace at dusk',
    );
  });

  it('announces a refusal in the dialog, and two the same in a row leave focus where the organiser takes it next', async () => {
    serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    const picker = within(dialog).getByRole('button', { name: 'Choose another photo' });
    pickInDialog(jpeg('a.gif', 'image/gif'));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.id).toBe('cover-dialog-refusal');
    await waitFor(() => expect(document.activeElement).toBe(picker));

    pickInDialog(jpeg('b.gif', 'image/gif'));
    await waitFor(() => expect(document.activeElement).toBe(picker));
    const describe = within(dialog).getByLabelText(/Describe the image/);
    describe.focus();
    fireEvent.change(describe, { target: { value: 'T' } });
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '31' } });

    expect(document.activeElement).toBe(describe);
  });

  it("refuses a wrong type from the dialog's picker before it uploads, under the picker, and the dialog stays open", async () => {
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    pickInDialog(jpeg('a.gif', 'image/gif'));

    expect(
      await within(dialog).findByText(
        'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Cover photo' })).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect(sent.map(({ line }) => line)).not.toContain('POST /api/orgs/org_1/event-cover-uploads');
  });
});

describe('Every pick is held under Uploading… until the server has read it (sc-17978)', () => {
  const PHOTO = {
    position: 30,
    description: 'Adaeze and Tunde under the arch',
    sizes: [
      { width: 640, url: 'http://store.test/c/small.webp' },
      { width: 1280, url: 'http://store.test/c/medium.webp' },
    ],
  };
  const DAMAGED = 'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.';

  function serving(cover: unknown) {
    const waiting = new Map<string, () => void>();
    const read = new Map<string, Promise<string>>();
    const signed: string[] = [];
    holding(cover, []);

    const preview = api.previewEventCoverUpload.bind(api);
    vi.spyOn(api, 'previewEventCoverUpload').mockImplementation((organisationId, uploadKey) => {
      const reading = preview(organisationId, uploadKey);
      read.set(uploadKey.split('/').pop()!, reading);
      return reading;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;

      if (line === 'POST /api/orgs/org_1/event-cover-uploads') {
        const { filename } = body as { filename: string };
        signed.push(filename);
        return json(
          {
            upload: {
              url: `http://store.test/upload/${filename}`,
              key: `event_cover/org_1/2026/10/${filename}`,
              content_type: 'image/jpeg',
            },
          },
          201,
        );
      }
      if (line.startsWith('PUT /upload/')) return new Response(null, { status: 200 });
      if (line === 'POST /api/orgs/org_1/event-cover-uploads/preview') {
        const name = (body as { uploadKey: string }).uploadKey.split('/').pop()!;
        await new Promise<void>((resolve) => waiting.set(name, resolve));
        return name.includes('damaged')
          ? problem(422, 'validation_failed', {
              violations: [{ propertyPath: 'file', message: DAMAGED, code: 'validation_failed' }],
            })
          : json({ preview: 'data:image/webp;base64,UklGRg==' });
      }
      if (line === 'DELETE /api/orgs/org_1/event-cover-uploads')
        return new Response(null, { status: 204 });

      return json({});
    });

    async function answer(name: string): Promise<void> {
      await waitFor(() => expect(waiting.has(name)).toBe(true));
      waiting.get(name)!();
    }

    /** Answers inside act and returns once the dialog's own await on the preview has run, and React has rendered whatever it did. */
    async function answerTaken(name: string): Promise<void> {
      await waitFor(() => expect(waiting.has(name)).toBe(true));
      await act(async () => {
        waiting.get(name)!();
        await read.get(name)!.catch(() => undefined);
      });
    }

    return { waiting, read, signed, answer, answerTaken };
  }

  function jpeg(name: string): File {
    return new File(['x'], name, { type: 'image/jpeg' });
  }

  function pickInDialog(chosen: File): void {
    fireEvent.change(document.getElementById('cover-dialog-file')!, {
      target: { files: [chosen] },
    });
  }

  async function changing(): Promise<HTMLElement> {
    await editingCover();
    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));

    return screen.findByRole('dialog', { name: 'Cover photo' });
  }

  function expectHeld(dialog: HTMLElement): void {
    expect(within(dialog).getByText('Uploading…')).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')).toBeNull();
    expect(dialog.querySelector('.cover-frame .cover-default-wedding')).not.toBeNull();
    expect(within(dialog).getByLabelText('Photo position').getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Use this photo' }).getAttribute('aria-disabled'),
    ).toBe('true');
  }

  beforeEach(() => {
    URL.createObjectURL = (chosen: Blob) => `blob:${(chosen as File).name}`;
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a good JPEG held at the server shows the default with nothing to position, then shows at the middle, keeping what was described', async () => {
    const { answer } = serving(PHOTO);
    const dialog = await changing();

    pickInDialog(jpeg('garden.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    expectHeld(dialog);
    const slider = within(dialog).getByLabelText('Photo position') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '80' } });
    expect(slider.value).toBe('50');
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'The garden at dusk' },
    });

    await answer('garden.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:garden.jpg'),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(slider.getAttribute('aria-disabled')).toBe('false');
    expect(slider.value).toBe('50');
    expect(document.activeElement).toBe(slider);
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      'The garden at dusk',
    );
  });

  it('a damaged JPEG is never in the frame between the pick and its refusal', async () => {
    const { answer } = serving(PHOTO);
    const dialog = await changing();

    pickInDialog(jpeg('damaged.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    expectHeld(dialog);

    await answer('damaged.jpg');

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
  });

  it('a second pick while the first uploads keeps the default until the second has been read', async () => {
    const { waiting, answer, answerTaken } = serving(PHOTO);
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('second.jpg'));
    await waitFor(() => expect(waiting.has('second.jpg')).toBe(true));

    await answerTaken('first.jpg');
    expectHeld(dialog);

    await answer('second.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:second.jpg'),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
  });

  /** The browser sizes the named file only when told to, so the first pick can answer meanwhile. */
  function sizingLater(name: string, width: number): () => void {
    let size: () => void = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(url: string) {
          if (url === `blob:${name}`) {
            this.naturalWidth = width;
            size = () => this.onload?.();
          } else queueMicrotask(() => this.onload?.());
        }
      },
    );

    return () => size();
  }

  it('the first pick answering while the browser sizes the second never shows', async () => {
    const { signed, answer, answerTaken } = serving(PHOTO);
    const size = sizingLater('second.jpg', 2400);
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('second.jpg'));
    await answerTaken('first.jpg');
    expectHeld(dialog);

    size();
    await waitFor(() => expect(signed).toContain('second.jpg'));
    expectHeld(dialog);
    await answer('second.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:second.jpg'),
    );
  });

  /** Picks `chosen` as soon as Uploading… is committed, before React runs that render's effects, so the pick lands ahead of the first upload starting. */
  function pickOnceUploading(
    dialog: HTMLElement,
    chosen: File,
  ): () => 'waiting' | 'early' | 'late' {
    let picked: 'waiting' | 'early' | 'late' = 'waiting';
    let started = false;
    const sign = api.signEventCoverUpload.bind(api);
    vi.spyOn(api, 'signEventCoverUpload').mockImplementation((...args) => {
      started = true;
      return sign(...args);
    });
    const watching = new MutationObserver(() => {
      if (picked !== 'waiting' || within(dialog).queryByText('Uploading…') == null) return;
      picked = started ? 'late' : 'early';
      watching.disconnect();
      pickInDialog(chosen);
    });
    watching.observe(dialog, { childList: true, subtree: true, characterData: true });

    return () => picked;
  }

  it('a second pick that lands before the first upload has started never shows the first', async () => {
    const { signed, answer, answerTaken } = serving(PHOTO);
    const size = sizingLater('second.jpg', 2400);
    const dialog = await changing();
    const pickedSecond = pickOnceUploading(dialog, jpeg('second.jpg'));

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(pickedSecond()).not.toBe('waiting'));
    expect(pickedSecond()).toBe('early');
    await answerTaken('first.jpg');
    expectHeld(dialog);

    size();
    await waitFor(() => expect(signed).toContain('second.jpg'));
    expectHeld(dialog);
    await answer('second.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:second.jpg'),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
  });

  it('a second pick refused before it uploads shows the first, read while the second was sized', async () => {
    const { waiting, answerTaken } = serving(PHOTO);
    const size = sizingLater('small.jpg', 10);
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('small.jpg'));
    await answerTaken('first.jpg');
    expectHeld(dialog);

    size();

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:first.jpg'),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(waiting.has('small.jpg')).toBe(false);
  });

  it('a parked first pick shown after the second is refused is what a later refusal gives back', async () => {
    const { answer, answerTaken } = serving(PHOTO);
    const size = sizingLater('small.jpg', 10);
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('small.jpg'));
    await answerTaken('first.jpg');
    size();
    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:first.jpg'),
    );

    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '70' } });
    pickInDialog(jpeg('damaged.jpg'));
    await answer('damaged.jpg');

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:first.jpg');
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('70');
  });

  it('a pick the server refuses after an earlier refusal gives back the frame as the host left it', async () => {
    const { answer } = serving(PHOTO);
    sizingEach({});
    const dialog = await changing();

    pickInDialog(jpeg('damaged.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    await answer('damaged.jpg');
    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());

    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '70' } });
    pickInDialog(jpeg('damaged-again.jpg'));
    await answer('damaged-again.jpg');

    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('70');
  });

  const TOO_SMALL =
    'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.';

  /** The browser sizes each named file only when `size(name)` says so, at the width given; any other file is sized at once. */
  function sizingEach(widths: Record<string, number>): (name: string) => void {
    const sizers = new Map<string, () => void>();
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(url: string) {
          const name = url.replace('blob:', '');
          if (name in widths) {
            this.naturalWidth = widths[name]!;
            sizers.set(name, () => this.onload?.());
          } else queueMicrotask(() => this.onload?.());
        }
      },
    );

    return (name) => {
      act(() => sizers.get(name)!());
    };
  }

  /** Lets a sized pick's check settle; a late pick lands inside these turns without the fix, which the red run shows. */
  async function sized(): Promise<void> {
    await act(async () => {
      for (let turn = 0; turn < 5; turn++) await Promise.resolve();
    });
  }

  it('a second pick made while the first is still being sized holds the frame, and the first never uploads', async () => {
    const { signed, answer } = serving(PHOTO);
    const size = sizingEach({ 'first.jpg': 2400, 'second.jpg': 2400 });
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    pickInDialog(jpeg('second.jpg'));
    size('first.jpg');
    await sized();
    expectHeld(dialog);

    size('second.jpg');
    await waitFor(() => expect(signed).toContain('second.jpg'));
    expectHeld(dialog);
    await answer('second.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:second.jpg'),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(signed).not.toContain('first.jpg');
  });

  it('a first pick sized after the second never replaces the second', async () => {
    const { signed, answer } = serving(PHOTO);
    const size = sizingEach({ 'first.jpg': 2400, 'second.jpg': 2400 });
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    pickInDialog(jpeg('second.jpg'));
    size('second.jpg');
    await waitFor(() => expect(signed).toContain('second.jpg'));
    size('first.jpg');
    await sized();
    expectHeld(dialog);
    await answer('second.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:second.jpg'),
    );
    expect(signed).not.toContain('first.jpg');
  });

  it('a slow second pick never replaces a third sized before it, while the first uploads', async () => {
    const { signed, answer } = serving(PHOTO);
    const size = sizingEach({ 'second.jpg': 2400, 'third.jpg': 2400 });
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(signed).toContain('first.jpg'));
    pickInDialog(jpeg('second.jpg'));
    pickInDialog(jpeg('third.jpg'));
    size('third.jpg');
    await waitFor(() => expect(signed).toContain('third.jpg'));
    size('second.jpg');
    await sized();
    expectHeld(dialog);
    await answer('third.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:third.jpg'),
    );
    expect(signed).not.toContain('second.jpg');
  });

  it('a first pick the server refuses while the second is sized stays held, then shows the second', async () => {
    const { signed, answer, answerTaken } = serving(PHOTO);
    const size = sizingEach({ 'second.jpg': 2400 });
    const dialog = await changing();

    pickInDialog(jpeg('damaged.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('second.jpg'));
    await answerTaken('damaged.jpg');
    expectHeld(dialog);
    expect(within(dialog).queryByText(DAMAGED)).toBeNull();

    size('second.jpg');
    await waitFor(() => expect(signed).toContain('second.jpg'));
    expectHeld(dialog);
    await answer('second.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:second.jpg'),
    );
    expect(within(dialog).queryByText(DAMAGED)).toBeNull();
  });

  it('a first pick the server refuses, then a second refused before it uploads, gives back what the dialog held', async () => {
    const { signed, answerTaken } = serving(PHOTO);
    const size = sizingEach({ 'small.jpg': 10 });
    const dialog = await changing();

    pickInDialog(jpeg('damaged.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('small.jpg'));
    await answerTaken('damaged.jpg');
    expectHeld(dialog);

    size('small.jpg');

    expect(await within(dialog).findByText(TOO_SMALL)).toBeDefined();
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    expect(signed).not.toContain('small.jpg');
  });

  it.each(['first.jpg', 'damaged.jpg'])(
    'a %s answer landing before the second pick commits never strands the second behind a refused third',
    async (first) => {
      // The offline band hears the first's answer and can re-render at SyncLane, which commits the second pick with it.
      vi.spyOn(connection, 'observe').mockImplementation(() => {});
      const { waiting, read, signed, answer } = serving(PHOTO);
      const sizers = new Map<string, () => void>();
      vi.stubGlobal(
        'Image',
        class {
          naturalWidth = 2400;
          naturalHeight = 1600;
          onload: (() => void) | null = null;
          set src(url: string) {
            const name = url.replace('blob:', '');
            if (name === 'small.jpg') this.naturalWidth = 10;
            if (name === first) queueMicrotask(() => this.onload?.());
            else sizers.set(name, () => this.onload?.());
          }
        },
      );
      const made: string[] = [];
      URL.createObjectURL = (chosen: Blob) => {
        made.push((chosen as File).name);
        return `blob:${(chosen as File).name}`;
      };
      const dialog = await changing();

      pickInDialog(jpeg(first));
      await waitFor(() => expect(waiting.has(first)).toBe(true));
      pickInDialog(jpeg('second.jpg'));
      await waitFor(() => expect(sizers.has('second.jpg')).toBe(true));
      let committedFirst = true;
      await act(async () => {
        sizers.get('second.jpg')!();
        // waitFor would lift act while it polls and let React's Scheduler commit the second pick; sizing settles in microtasks.
        for (
          let turn = 0;
          turn < 50 && made.filter((name) => name === 'second.jpg').length < 2;
          turn++
        )
          await Promise.resolve();
        expect(made.filter((name) => name === 'second.jpg')).toHaveLength(2);
        waiting.get(first)!();
        await read.get(first)!.catch(() => undefined);
        for (let turn = 0; turn < 5; turn++) await Promise.resolve();
        committedFirst = signed.includes('second.jpg');
      });
      expect(committedFirst).toBe(false);

      await waitFor(() => expect(signed).toContain('second.jpg'));
      pickInDialog(jpeg('small.jpg'));
      await waitFor(() => expect(sizers.has('small.jpg')).toBe(true));
      act(() => sizers.get('small.jpg')!());
      expect(await within(dialog).findByText(TOO_SMALL)).toBeDefined();
      await answer('second.jpg');

      await waitFor(() =>
        expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(
          'blob:second.jpg',
        ),
      );
      expect(within(dialog).queryByText('Uploading…')).toBeNull();
    },
  );

  it.each([
    ['first.jpg', 'is read after it, shows the first'],
    ['damaged.jpg', 'is refused after it, gives back the saved photo with its own refusal'],
  ])(
    'a second pick refused at sizing while a %s uploads leaves the first awaited: a first that %s',
    async (first) => {
      const { signed, answer } = serving(PHOTO);
      const size = sizingEach({ 'small.jpg': 10 });
      const dialog = await changing();

      pickInDialog(jpeg(first));
      await waitFor(() => expect(signed).toContain(first));
      pickInDialog(jpeg('small.jpg'));
      size('small.jpg');
      expect(await within(dialog).findByText(TOO_SMALL)).toBeDefined();
      expectHeld(dialog);

      await answer(first);

      if (first === 'first.jpg') {
        await waitFor(() =>
          expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(
            'blob:first.jpg',
          ),
        );
      } else {
        expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
        expect(within(dialog).queryByText(TOO_SMALL)).toBeNull();
        expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(
          PHOTO.sizes[0]!.url,
        );
      }
      expect(within(dialog).queryByText('Uploading…')).toBeNull();
      expect(signed).not.toContain('small.jpg');
    },
  );

  it('a second pick refused before it uploads, while the first is still being sized, gives back what the dialog held, and the next pick is one pick', async () => {
    const { signed, answer } = serving(PHOTO);
    const size = sizingEach({ 'first.jpg': 2400, 'small.jpg': 10 });
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    pickInDialog(jpeg('small.jpg'));
    size('small.jpg');

    expect(await within(dialog).findByText(TOO_SMALL)).toBeDefined();
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    const slider = within(dialog).getByLabelText('Photo position') as HTMLInputElement;
    expect(slider.value).toBe('30');
    size('first.jpg');
    await sized();
    expect(signed).toEqual([]);

    fireEvent.change(slider, { target: { value: '70' } });
    const describing = within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement;
    fireEvent.change(describing, { target: { value: 'The arch at noon' } });
    pickInDialog(jpeg('damaged.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    await answer('damaged.jpg');

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    expect(slider.value).toBe('70');
    expect(describing.value).toBe('The arch at noon');
  });

  it('a second pick refused while the first is sized, with nothing saved, keeps focus on the picker', async () => {
    const { answer } = serving(null);
    const size = sizingEach({ 'first.jpg': 2400, 'small.jpg': 10 });
    await editingCover();
    fireEvent.change(document.getElementById('cover-file')!, {
      target: { files: [jpeg('damaged.jpg')] },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await answer('damaged.jpg');
    await waitFor(() => expect(dialog.querySelector('.cover-choose')).not.toBeNull());

    pickInDialog(jpeg('first.jpg'));
    pickInDialog(jpeg('small.jpg'));
    size('small.jpg');

    expect(await within(dialog).findByText(TOO_SMALL)).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(dialog.querySelector('.cover-choose button')),
    );
  });
});
