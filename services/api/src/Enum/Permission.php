<?php

declare(strict_types=1);

namespace App\Enum;

/** The registry: a policy can only name a case, so a permission outside it cannot be asked for. */
enum Permission: string
{
    case OrganisationManage = 'organisation.manage';
}
