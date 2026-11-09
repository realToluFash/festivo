<?php

declare(strict_types=1);

namespace App\Enum;

/** Whether the invitation email left: support's to read (epic 28), never shown to an administrator. */
enum InvitationDelivery: string
{
    case Queued = 'queued';
    case Sent = 'sent';
    case Failed = 'failed';
}
