/** Whether the header is still held back from TalkBack: it starts when a cover ends on Android, and a new cover ends it. */
export function settlingAfter(
  settling: boolean,
  covered: boolean,
  wasCovered: boolean,
  android: boolean,
): boolean {
  if (covered) return false;
  return wasCovered ? android : settling;
}
