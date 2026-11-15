/** What the demo is filled with and answers to. Nothing here reaches the API. */
export const SAMPLE = {
  name: 'Folake Adeyemi',
  email: 'folake@ire.events',
  password: 'correct horse battery',
  organisation: 'Ire Events',
  country: 'United Kingdom',
  phoneCountry: { flag: '🇬🇧', dial: '+44', name: 'United Kingdom' },
  phone: '7400 123456',
  phoneShown: '+44 7400 123456',
  /** Every code Soirely sends: by email, by WhatsApp and by text. */
  code: '482913',
  authenticator: '714302',
  recovery: 'vtxp-rh7y',
  joinMessage: 'Hi Ade, it’s Folake from the Lagos team.',
  askedAt: 'Tuesday 3 Nov at 01:25',
  endsAt: 'Tuesday 10 Nov at 01:25',
} as const;
