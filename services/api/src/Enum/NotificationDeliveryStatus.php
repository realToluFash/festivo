<?php

declare(strict_types=1);

namespace App\Enum;

/** A delivery's outcome per person per channel. Collapsed rows are Sent, naming the row they went out in. */
enum NotificationDeliveryStatus: string
{
    case Pending = 'pending';
    case Sent = 'sent';
    case Failed = 'failed';
    case Cancelled = 'cancelled';
    case TooLate = 'too_late';
}
