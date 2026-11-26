/** A host's messages to an event's guests (sc-3942), as the API answers them. */
export type GuestMessageAudience = 'all' | 'chosen' | 'conditions';

/** Who gets it's conditions (sc-3957), combined with AND; `groupId` null is No group. */
export type GuestCondition =
  | {
      type:
        | 'replied'
        | 'notReplied'
        | 'coming'
        | 'notComing'
        | 'notSure'
        | 'invited'
        | 'notInvited'
        | 'hasEmail'
        | 'hasMobile';
    }
  | { type: 'inGroup'; groupId: string | null };

/** A condition as the API reads it back: an `inGroup` one names its group as it is now, and says when it was deleted. */
export type ShownCondition =
  | Exclude<GuestCondition, { type: 'inGroup' }>
  | { type: 'inGroup'; groupId: string | null; group: { name: string; deleted: boolean } | null };

/** The live count and See who: each guest with the ways Soirely can tell them. */
export interface AudienceMatch {
  count: number;
  conditions: ShownCondition[];
  guests: { id: string; name: string; email: boolean; mobile: boolean }[];
}

export interface SavedAudience {
  id: string;
  name: string;
  conditions: ShownCondition[];
}

/** Saved audiences A to Z, and the event's groups A to Z for Is in group. */
export interface AudienceBook {
  audiences: SavedAudience[];
  groups: { id: string; name: string }[];
}

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
  /** The message's own copy of its conditions, when `audience` is `conditions`. */
  conditions: ShownCondition[] | null;
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
  /** The language Soirely's words reach them in (sc-3790). */
  language: string;
}

/** Which step of sc-3790's rule gave a guest's language. */
export type LanguageFrom = 'chose' | 'host' | 'organisation';

/** As one guest will see it (sc-3960): who they are greeted as, their language and why, and each channel's notice. */
export interface GuestMessagePreview {
  guest: {
    id: string;
    name: string;
    greetAs: string | null;
    language: string;
    languageFrom: LanguageFrom;
  };
  notices: { channel: 'email'; subject: string; text: string }[];
}

export interface GuestMessageInput {
  audience: GuestMessageAudience;
  guestIds?: string[];
  conditions?: GuestCondition[];
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
