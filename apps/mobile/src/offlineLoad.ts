import { keepsWhatLoaded } from '@soirely/domain';

/** What a failed load leaves on screen: what loaded stays, under the band, only when Soirely never answered (sc-22586). */
export function afterFailedLoad<L extends { kind: string }>(
  before: L,
  error: unknown,
  failed: L,
): L {
  return before.kind === 'loaded' && keepsWhatLoaded(error) ? before : failed;
}
