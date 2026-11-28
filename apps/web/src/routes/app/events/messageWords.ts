import { type MessageToken, messageSegments } from '@soirely/domain';
import type { TFunction } from 'i18next';

export function tokenWord(t: TFunction, token: MessageToken): string {
  return t(`eventMessages.token.${token}`);
}

export function tokenName(t: TFunction, token: MessageToken): string {
  return t('eventMessages.tokenName', { token: tokenWord(t, token) });
}

/** A title or a line in the list, where a token reads as its word. */
export function plainWords(t: TFunction, wire: string): string {
  return messageSegments(wire)
    .map((segment) => (segment.kind === 'text' ? segment.text : tokenWord(t, segment.token)))
    .join('');
}
