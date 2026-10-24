<?php

declare(strict_types=1);

namespace App\Enum;

/** What settling a due claim did, which decides who is emailed. */
enum OwnerClaimMoment
{
    case Found;
    case Passed;
    case Lapsed;
    case Ended;
}
