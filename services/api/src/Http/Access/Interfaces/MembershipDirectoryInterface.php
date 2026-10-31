<?php

declare(strict_types=1);

namespace App\Http\Access\Interfaces;

use App\Entity\User;
use App\Http\Access\Grants;
use Symfony\Component\Uid\Uuid;

interface MembershipDirectoryInterface
{
    /** Null unless the account is an active member: a suspended or departed one holds nothing. */
    public function grantsIn(User $user, Uuid $organisationId): ?Grants;
}
