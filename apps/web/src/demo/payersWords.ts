/** sc-1300's Send in a payer's pane, the English for the web's demo (budget-a-spec.md §8): Who is paying itself is the product's, in its locales. */
export const PAYERS_WORDS = {
  sendTo: (name: string) => `Send to ${name}`,
  sendAgain: 'Send again',
  sendAgainTo: (name: string) => `Send again to ${name}`,
  sending: 'Sending…',
  linkCopied: 'Link copied. Paste it into a chat.',
  theLink: 'The link',
  copyRefused: 'Could not copy here. The link is selected: press Ctrl+C or Command+C.',
  notCreated: 'The link was not created, so nothing has been sent. Try again.',
  asksPassphrase: 'Asks for a passphrase.',
  browserSheet: 'The browser’s share sheet',
  message: (event: string) => `Your share of ${event}, kept up to date.`,
  close: 'Close',
} as const;
