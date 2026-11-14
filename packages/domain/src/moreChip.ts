/** What a row of faces' round chip writes for the people it leaves out: +1 to +99, then 99+, so it fits its circle in every language. */
export function moreChip(more: number): string {
  return more > 99 ? '99+' : `+${more}`;
}
