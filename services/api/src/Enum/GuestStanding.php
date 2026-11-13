<?php

declare(strict_types=1);

namespace App\Enum;

/** Where one person on the list stands (sc-99): never stored, always derived from the reply that decides it. */
enum GuestStanding
{
    case Accepted;
    case Maybe;
    case AwaitingReply;
    case HeldHostNoReply;
    case HeldHostMaybe;
    case HeldHostNotComing;
    case Declined;

    /** For a companion, `reply` is their host's: they are Coming only once the host is, and Held otherwise, never Not coming. */
    public static function of(GuestReply $reply, bool $companion): self
    {
        if ($companion) {
            return match ($reply) {
                GuestReply::Coming => self::Accepted,
                GuestReply::Maybe => self::HeldHostMaybe,
                GuestReply::NotComing => self::HeldHostNotComing,
                GuestReply::NoReply => self::HeldHostNoReply,
            };
        }

        return match ($reply) {
            GuestReply::Coming => self::Accepted,
            GuestReply::Maybe => self::Maybe,
            GuestReply::NotComing => self::Declined,
            GuestReply::NoReply => self::AwaitingReply,
        };
    }

    public function isHeld(): bool
    {
        return match ($this) {
            self::HeldHostNoReply, self::HeldHostMaybe, self::HeldHostNotComing => true,
            default => false,
        };
    }
}
