/** RFC 6266 §4.3: `filename*` when it decodes, else `filename`. */
export function downloadName(disposition: string | null): string | null {
  if (disposition == null) return null;

  const parameters = dispositionParameters(disposition);
  const extended = parameters.get('filename*');
  const decoded = extended == null ? null : extendedValue(extended);

  if (decoded != null && decoded !== '') return decoded;

  const plain = parameters.get('filename');

  return plain == null || plain === '' ? null : plain;
}

function dispositionParameters(disposition: string): Map<string, string> {
  const parameters = new Map<string, string>();
  const pattern = /;\s*([^\s=;]+)\s*=\s*("(?:[^"\\]|\\.)*"|[^;]*)/g;

  for (const [, key = '', raw = ''] of disposition.matchAll(pattern)) {
    const name = key.toLowerCase();
    if (parameters.has(name)) continue;
    const value = raw.trim();
    parameters.set(
      name,
      value.startsWith('"') ? value.slice(1, -1).replace(/\\(.)/g, '$1') : value,
    );
  }

  return parameters;
}

function extendedValue(value: string): string | null {
  const match = /^([^']*)'[^']*'(.*)$/.exec(value);
  if (match == null) return null;
  const [, charset = '', encoded = ''] = match;

  try {
    switch (charset.toLowerCase()) {
      case 'utf-8':
        return decodeURIComponent(encoded);
      case 'iso-8859-1':
        return encoded.replace(/%([0-9a-f]{2})/gi, (_, hex: string) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
      default:
        return null;
    }
  } catch {
    return null;
  }
}
