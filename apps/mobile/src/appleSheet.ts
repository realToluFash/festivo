/** Apple's sheet closed with nobody signed in: cancelled, or unknown (1000), which is what closing "Sign in to your Apple Account" on a device with no Apple Account reports (sc-94849). */
export function appleSheetClosed(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;

  return code === 'ERR_REQUEST_CANCELED' || code === 'ERR_REQUEST_UNKNOWN';
}
