/** The tokens write tracking in em, as CSS does; React Native wants points, so this multiplies it by the face's size. */
export function tracking(type: { size: number; letterSpacing: string }): number {
  const em = Number.parseFloat(type.letterSpacing);

  return Number.isNaN(em) ? 0 : em * type.size;
}
