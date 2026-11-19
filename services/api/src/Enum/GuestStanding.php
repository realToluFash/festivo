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
    case NotYetInvited;

    /** For a companion, `reply` and `invited` are their host's: Held while the host is not Coming, then Coming unless the guest marked them Not coming (sc-3779). Nobody is waiting on a reply until they are invited (sc-3788). */
    public static function of(GuestReply $reply, bool $companion, bool $invited, bool $notComingByGuest = false): self
    {
        if (!$invited && GuestReply::NoReply === $reply) {
            return self::NotYetInvited;
        }

        if ($companion) {
            return match ($reply) {
                GuestReply::Coming => $notComingByGuest ? self::Declined : self::Accepted,
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
