<?php

declare(strict_types=1);

namespace App\Enum;

/** How a type treats a paused, finished or deleted event (epic 36, §9). */
enum NotificationEventRule: string
{
    /** Waits while paused, and is not sent once the event has finished. */
    case Automatic = 'automatic';

    /** Waits while paused, and still goes after the event has finished: payment reminders (sc-95). */
    case AfterConclusion = 'after_conclusion';

    /** Goes while paused, and for 30 days after the event ends (sc-3942). */
    case HostMessage = 'host_message';

    /** Goes while paused (sc-4330). */
    case ChangeNotice = 'change_notice';

    /** Still goes after the event is deleted: the members' notice of it (sc-13214) and a call-off sent before it (sc-4330). */
    case DeletionNotice = 'deletion_notice';
}
