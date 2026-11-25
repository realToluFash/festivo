import type { Token } from './MessagesSample.ts';

/** sc-3960's English for Insert and the preview ('English copy (l10n)', 27 Oct, reworded 7 Nov, the braces line settled 8 Nov). */
export const PW = {
  previewAs: 'Preview as',
  braces:
    'Anything you type in braces shows exactly as typed. To fill something in for each guest, use Insert.',
  noTokens: 'Nothing to fill in, so every guest gets exactly these words.',
} as const;

/** Each Insert row's line, under the token's word. */
export const TOKEN_LINE: Record<Token, string> = {
  Greeting: 'Their Greet as, or their full name if they have none',
  Event: 'The event’s name',
  Date: 'The event’s day, or its days',
  Hosts: 'The event’s hosts',
};

export const sayPreview = {
  option: (name: string, language: string) => `${name} · ${language}`,
  greetedAs: (greetAs: string) => `Greeted as “${greetAs}”, their Greet as.`,
  chose: (language: string) => `In ${language}, the language they chose on their page.`,
  organisation: (language: string) =>
    `In ${language}, your organisation’s language, as no language is set for them.`,
  filling: (name: string) => `Filling it in for ${name}…`,
};
