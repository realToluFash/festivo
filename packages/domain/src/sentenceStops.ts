const OWN_STOPS = ['.', '!', '?', '…'];

/** A value ending in ".", "!", "?" or "…" ends the sentence it is put into, as in print (sc-2573). */
export function endsSentence(value: string): boolean {
  return OWN_STOPS.some((stop) => value.endsWith(stop));
}

interface Interpolator {
  // Set by i18next at runtime, already regex-escaped, and missing from its types.
  prefix?: string;
  suffix?: string;
  interpolate(str: string, data: object, lng: string, options: object): string;
}

/** Only a full stop is dropped: an abbreviation keeps its stop before ",", "?", a space or a closing quote. */
export function followValueStops(interpolator: Interpolator): void {
  const interpolate = interpolator.interpolate.bind(interpolator);

  interpolator.interpolate = (str, data, lng, options) => {
    // Read on every call: a Trans component swaps the delimiters for the length of one call.
    const { prefix = '\\{\\{', suffix = '\\}\\}' } = interpolator;
    const placeholderThenStop = new RegExp(`(${prefix}(?:(?!${suffix}).)+${suffix})\\.`, 'g');
    const template = str.replace(placeholderThenStop, (withStop, placeholder: string) =>
      endsSentence(interpolate(placeholder, data, lng, options)) ? placeholder : withStop,
    );

    return interpolate(template, data, lng, options);
  };
}
