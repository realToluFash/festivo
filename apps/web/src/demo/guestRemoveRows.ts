import { type Guest, type Reply, companionName } from './guests.ts';
import { REPLY_WORDS } from './guestsWords.ts';
import { RMW } from './guestRemove.ts';

export interface GoesRow {
  key: string;
  reply: Reply;
  title: string;
  lines: string[];
}

/** The confirmation's rows: their reply, then each companion with their reply and only the seat and meal that exist. A Held companion reads Held. */
export function goesWith(guest: Guest): GoesRow[] {
  return [
    {
      key: 'reply',
      reply: guest.reply,
      title: REPLY_WORDS[guest.reply],
      lines: [RMW.theirReply],
    },
    ...guest.companions.map((one) => ({
      key: one.id,
      reply: one.reply,
      title: companionName(guest, one),
      lines: [
        [
          `${RMW.companion} · ${REPLY_WORDS[one.reply]}`,
          one.table == null ? null : RMW.seatedAt(one.table),
          one.meal === true ? RMW.mealChosen : null,
        ]
          .filter((part) => part != null)
          .join(' · '),
      ],
    })),
  ];
}

/** "{full name} removed", naming the companions that went with them. */
export function removedLine(guest: Guest): string {
  return RMW.removed(
    guest.name,
    guest.companions.map((one) => companionName(guest, one)),
  );
}
