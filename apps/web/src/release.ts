/** The build's content-hashed files, so a restart or a redeploy of the same commit is no new release. */
export function releaseOf(page: Document): string | null {
  const files = [...page.querySelectorAll<HTMLElement>('script[src], link[rel="stylesheet"][href]')]
    .map((element) => element.getAttribute('src') ?? element.getAttribute('href') ?? '')
    .filter((file) => file.startsWith('/assets/'))
    .sort();

  return files.length === 0 ? null : files.join(' ');
}

/** Read before the bundle adds a stylesheet of its own, which the deployed HTML would not name. */
const loaded = releaseOf(document);

export const CHECK_EVERY_MS = 30 * 60 * 1000;

/** True once the deployed web is a different release; null when the check could not finish. */
export async function deployedDiffers(
  fetcher: typeof fetch = fetch,
  ours: string | null = loaded,
): Promise<boolean | null> {
  if (ours == null) return null;

  try {
    const response = await fetcher(`/index.html?t=${Date.now()}`, { cache: 'no-store' });

    if (!response.ok) return null;

    const deployed = releaseOf(new DOMParser().parseFromString(await response.text(), 'text/html'));

    return deployed == null ? null : deployed !== ours;
  } catch {
    return null;
  }
}
