<?php

declare(strict_types=1);

namespace App\Enum;

/** Which date closes a course's picks (sc-3905): the course's own choose-by date first (sc-1362), then Reply by, then the start. */
enum PicksCloseSource: string
{
    case ChooseBy = 'chooseBy';
    case ReplyBy = 'replyBy';
    case Start = 'start';
}
