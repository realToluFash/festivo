import type { NotificationCategory } from '@soirely/api-client';

import type { GlyphName } from './Glyph.tsx';

/** Each category's one mark, in Notification settings and beside the bell's items (sc-83081). */
export const CATEGORY_MARK: Record<NotificationCategory, GlyphName> = {
  guest_replies: 'users',
  messages: 'chat',
  event_day: 'today',
  event_changes: 'calendar',
  money: 'wallet',
  account_security: 'shield',
};

/** A category the client does not know draws no mark, and its item keeps its words. */
export function markOf(category: string): GlyphName | null {
  return Object.hasOwn(CATEGORY_MARK, category)
    ? CATEGORY_MARK[category as NotificationCategory]
    : null;
}
