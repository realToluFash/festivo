import { describe, expect, it } from 'vitest';

import { deployedDiffers, releaseOf } from './release.ts';

const BUILT = `<!doctype html><html><head>
  <script type="module" crossorigin src="/assets/index-a1.js"></script>
  <link rel="stylesheet" crossorigin href="/assets/index-b2.css">
</head><body><div id="root"></div></body></html>`;

function page(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function serving(body: string, status = 200): typeof fetch {
  return () => Promise.resolve(new Response(body, { status }));
}

describe('releaseOf', () => {
  it('names a built page by the hashed files it loads', () => {
    expect(releaseOf(page(BUILT))).toBe('/assets/index-a1.js /assets/index-b2.css');
  });

  it('gives the dev server, which loads no hashed files, no release', () => {
    expect(releaseOf(page('<script type="module" src="/src/main.tsx"></script>'))).toBeNull();
  });
});

describe('deployedDiffers', () => {
  const ours = releaseOf(page(BUILT));

  it('is false while the same release is deployed', async () => {
    await expect(deployedDiffers(serving(BUILT), ours)).resolves.toBe(false);
  });

  it('is true once a build with other files is deployed', async () => {
    await expect(
      deployedDiffers(serving(BUILT.replace('index-a1', 'index-c3')), ours),
    ).resolves.toBe(true);
  });

  it('cannot tell when the check fails or answers with something else', async () => {
    await expect(deployedDiffers(serving(BUILT, 502), ours)).resolves.toBeNull();
    await expect(deployedDiffers(serving('{"error":true}'), ours)).resolves.toBeNull();
    await expect(
      deployedDiffers(() => Promise.reject(new TypeError('offline')), ours),
    ).resolves.toBeNull();
  });

  it('never checks from a tab that has no release', async () => {
    let asked = false;
    const fetcher: typeof fetch = () => {
      asked = true;
      return Promise.resolve(new Response(BUILT));
    };

    await expect(deployedDiffers(fetcher, null)).resolves.toBeNull();
    expect(asked).toBe(false);
  });
});
