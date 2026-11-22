/** Counts extended grapheme clusters, as the API's VisibleText does (sc-54292). */
export function visibleLength(text: string): number {
  if (typeof Intl.Segmenter === 'function') {
    let count = 0;

    for (const _ of new Intl.Segmenter().segment(text)) count += 1;

    return count;
  }

  return clusterLength(text);
}

/** UAX #29's common clusters, for a runtime without Intl.Segmenter such as Hermes. */
const CLUSTER =
  /\r\n|\p{Regional_Indicator}{2}|[\u1100-\u115F]+[\u1160-\u11A7]*[\u11A8-\u11FF]*|[^](?:[\p{M}\u200C\u{E0020}-\u{E007F}]|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*/gu;

export function clusterLength(text: string): number {
  return text.match(CLUSTER)?.length ?? 0;
}
