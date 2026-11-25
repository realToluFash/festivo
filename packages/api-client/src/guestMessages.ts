/** A host's messages to an event's guests (sc-3942), as the API answers them. */
export type GuestMessageAudience = 'all' | 'chosen';

/** Why email can't tell a guest; `provider_blocked` and `failed` only ever end a delivery, never flag a guest. */
export type NotSentReason =
  'no_address' | 'bouncing' | 'complained' | 'provider_blocked' | 'failed';

export type DeliveryState =
  'queued' | 'sent' | 'delivered' | 'reported_as_spam' | 'bounced' | 'not_sent';

export interface GuestMessageSummary {
  id: string;
  subject: string | null;
  firstLine: string;
  audience: GuestMessageAudience;
  channels: string[];
  sentBy: string;
  sentAt: string;
  reached: number;
  sending: boolean;
  /** The conversation's first message, on a follow-up; null on the first itself. */
  follows: string | null;
}

export interface GuestMessageRow extends GuestMessageSummary {
  deliveries: number;
}

export interface GuestMessageDelivery {
  guestId: string;
  name: string | null;
  channel: 'email';
  state: DeliveryState;
  reason: NotSentReason | null;
  /** The receiving server's enhanced status code on a bounce or a complaint, "5.1.1" say. */
  code: string | null;
  at: string | null;
  /** Only for a member with guests.manage; null when the guest had none. */
  address?: string | null;
}

export interface GuestMessageDetails extends GuestMessageSummary {
  message: string;
  deliveries: GuestMessageDelivery[];
}

export interface GuestMessageCheck {
  people: number;
  toldByEmail: number;
  cantBeTold: { guestId: string; name: string; reason: NotSentReason }[];
}

/** One guest in Choose guests: `email` only for a member with guests.manage. */
export interface PickableGuest {
  id: string;
  name: string;
  flag: 'no_address' | 'bouncing' | 'complained' | null;
  email?: string | null;
}

export interface GuestMessageInput {
  audience: GuestMessageAudience;
  guestIds?: string[];
  subject?: string | null;
  message: string;
  follows?: string | null;
}

export interface GuestMessageSent {
  id: string;
  queued: { email: number };
  notSent: { email: number };
}

/** What a message is called where it has no Subject: its first line. */
export function guestMessageTitle(
  message: Pick<GuestMessageSummary, 'subject' | 'firstLine'>,
): string {
  const subject = message.subject?.trim() ?? '';

  return subject === '' ? message.firstLine : subject;
}
