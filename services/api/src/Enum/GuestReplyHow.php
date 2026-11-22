<?php

declare(strict_types=1);

namespace App\Enum;

/** How a guest told the host who recorded their reply (sc-3787). */
enum GuestReplyHow: string
{
    case Phone = 'phone';
    case InPerson = 'inPerson';
    case Message = 'message';
    case Other = 'other';
}
