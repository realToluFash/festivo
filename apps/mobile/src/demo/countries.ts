export interface Country {
  code: string;
  flag: string;
  dial: string;
  name: string;
}

/** A short list for the demo; the build keeps today's searchable list of every country. */
export const COUNTRIES: readonly Country[] = [
  { code: 'GB', flag: '🇬🇧', dial: '+44', name: 'United Kingdom' },
  { code: 'NG', flag: '🇳🇬', dial: '+234', name: 'Nigeria' },
  { code: 'US', flag: '🇺🇸', dial: '+1', name: 'United States' },
  { code: 'ES', flag: '🇪🇸', dial: '+34', name: 'Spain' },
  { code: 'FR', flag: '🇫🇷', dial: '+33', name: 'France' },
  { code: 'BR', flag: '🇧🇷', dial: '+55', name: 'Brazil' },
  { code: 'PT', flag: '🇵🇹', dial: '+351', name: 'Portugal' },
  { code: 'MX', flag: '🇲🇽', dial: '+52', name: 'Mexico' },
];
