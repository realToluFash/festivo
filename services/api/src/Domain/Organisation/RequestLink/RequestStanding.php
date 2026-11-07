<?php

declare(strict_types=1);

namespace App\Domain\Organisation\RequestLink;

/** Why somebody opening a request link cannot ask: they belong, they are waiting, or they were turned down lately. */
enum RequestStanding: string
{
    case Member = 'member';
    case Waiting = 'waiting';
    case CoolingOff = 'cooling_off';
}
