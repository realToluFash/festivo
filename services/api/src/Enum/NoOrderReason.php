<?php

declare(strict_types=1);

namespace App\Enum;

/** The word in place of a guest's order when there is none (sc-4005). Nothing sets Left until a story records a guest leaving. */
enum NoOrderReason: string
{
    case NotHereYet = 'notHereYet';
    case NothingForThisCourse = 'nothingForThisCourse';
    case Left = 'left';
}
