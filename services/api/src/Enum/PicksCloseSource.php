<?php

declare(strict_types=1);

namespace App\Enum;

/** Which date closes a course's picks (sc-3905). sc-1362 adds the course's own choose-by date ahead of both. */
enum PicksCloseSource: string
{
    case ReplyBy = 'replyBy';
    case Start = 'start';
}
