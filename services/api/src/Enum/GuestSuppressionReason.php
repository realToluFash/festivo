<?php

declare(strict_types=1);

namespace App\Enum;

/** Why an organisation's guest list stops an address on a channel (sc-3969). A complaint outranks the guest's own opt-out. */
enum GuestSuppressionReason: string
{
    case Complained = 'complained';
    /** The guest turned email off: the one-click POST, the page's button or its switch. */
    case Unsubscribed = 'unsubscribed';
    /** The guest turned texts or WhatsApp off, on the page or by keyword. */
    case OptedOut = 'opted_out';

    public static function of(GuestChannel $channel): self
    {
        return GuestChannel::Email === $channel ? self::Unsubscribed : self::OptedOut;
    }

    public function notSent(): DeliveryNotSentReason
    {
        return match ($this) {
            self::Complained => DeliveryNotSentReason::Complained,
            self::Unsubscribed => DeliveryNotSentReason::Unsubscribed,
            self::OptedOut => DeliveryNotSentReason::OptedOut,
        };
    }
}
