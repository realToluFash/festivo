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
  /** Longer than the Message box shows, and under the most. */
  joinMessageLong:
    'Hi Ade, it’s Folake from the Lagos team. We met at the planners’ breakfast in Ikoyi last month, where you said Ire Events was looking for someone to run guest lists and seating for the December weddings. I’ve run the door and the floor plan for over forty weddings since 2021, most of them between two and five hundred guests, and I’m free every weekend from the fifth of December. I’d love to help with the Adeyemi wedding first if it still needs hands. Thank you!',
  askedAt: 'Tuesday, Nov 3 at 01:25 GMT',
  endsAt: 'Tuesday, Nov 10 at 01:25 GMT',
} as const;
