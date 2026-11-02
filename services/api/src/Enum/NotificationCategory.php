<?php

declare(strict_types=1);

namespace App\Enum;

/** The six categories a member sets Push and Email by (epic 36, §5). They are also Android's notification channels, so fixed. */
enum NotificationCategory: string
{
    case GuestReplies = 'guest_replies';
    case Messages = 'messages';
    case EventDay = 'event_day';
    case EventChanges = 'event_changes';
    case Money = 'money';
    case AccountSecurity = 'account_security';

    /** Mute this event keeps the bell and holds back the rest, except what cannot wait. */
    public function heldByMute(): bool
    {
        return self::EventDay !== $this && self::AccountSecurity !== $this;
    }
}
