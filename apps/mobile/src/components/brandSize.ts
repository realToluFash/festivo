import { logo } from '../theme/logo.ts';

export type BrandSize = { width: number; height?: never } | { height: number; width?: never };

/** Either side sets the size, and the other follows the drawing's own proportions. */
export function brandSize(lockup: boolean, size: BrandSize): { width: number; height: number } {
  const box = lockup ? logo.lockup.viewBox : logo.wordmark.viewBox;

  return size.width != null
    ? { width: size.width, height: (size.width * box.height) / box.width }
    : { width: (size.height * box.width) / box.height, height: size.height };
}
