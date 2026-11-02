import i18next, { type TFunction } from 'i18next';
import { useEffect } from 'react';

const named: string[] = [];

/** "Members – Settings – Soirely": the page's own words, most specific first. */
export function pageTitle(t: TFunction, parts: readonly string[]): string {
  return parts.reduceRight<string>(
    (rest, page) => t('pageTitle.part', { page, rest }),
    t('app.name'),
  );
}

/** A title other than the page's heading, for as long as the caller is on screen. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    named.push(title);
    retitle();

    return () => {
      named.splice(named.lastIndexOf(title), 1);
      retitle();
    };
  }, [title]);
}

export function retitle(): void {
  const heading = document.querySelector('h1')?.textContent?.trim() ?? '';
  const title =
    named.at(-1) ?? (heading === '' ? i18next.t('app.name') : pageTitle(i18next.t, [heading]));

  if (document.title !== title) document.title = title;
}
