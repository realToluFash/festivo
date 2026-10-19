<?php

declare(strict_types=1);

namespace App\Enum;

/** The way a membership changed, recorded on each transition (sc-67). */
enum MembershipChannel: string
{
    case Invitation = 'invitation';
    case SelfCreated = 'self_created';
    case JoinCode = 'join_code';
    case Domain = 'domain';
    case Request = 'request';
    case Directory = 'directory';
}
