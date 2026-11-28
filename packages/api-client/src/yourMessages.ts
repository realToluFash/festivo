/** sc-3969's three channels on Your messages, always in this order. */
export type MessageChannel = 'email' | 'texts' | 'whatsApp';

export const MESSAGE_CHANNELS: readonly MessageChannel[] = ['email', 'texts', 'whatsApp'];

/** Per channel only whether an address is on record and whether it is on: never the address, the name or a date (a link in an email gets forwarded). */
export interface MessageChannelStanding {
  onRecord: boolean;
  on: boolean;
}

export interface YourMessages {
  organisation: string;
  channels: Record<MessageChannel, MessageChannelStanding>;
}

/** The email's link carries its own token; the guest's page sends the guest's link token. */
export type YourMessagesKey = { token: string } | { guestToken: string };

function standingOf(value: unknown): MessageChannelStanding {
  const raw = (typeof value === 'object' && value != null ? value : {}) as Record<string, unknown>;
  const onRecord = raw.onRecord === true;

  return { onRecord, on: onRecord && raw.on === true };
}

export function yourMessagesOf(body: unknown): YourMessages {
  const raw = (typeof body === 'object' && body != null ? body : {}) as Record<string, unknown>;
  const channels = (
    typeof raw.channels === 'object' && raw.channels != null ? raw.channels : {}
  ) as Record<string, unknown>;

  return {
    organisation: typeof raw.organisation === 'string' ? raw.organisation : '',
    channels: {
      email: standingOf(channels.email),
      texts: standingOf(channels.texts),
      whatsApp: standingOf(channels.whatsApp),
    },
  };
}
