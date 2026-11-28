/** As near to `wanted` as items `content` tall scroll in a panel `panel` tall. */
export function reachableOffset(wanted: number, content: number, panel: number): number {
  return Math.min(wanted, Math.max(0, content - panel));
}
