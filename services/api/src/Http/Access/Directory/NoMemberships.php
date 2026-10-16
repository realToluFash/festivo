<?php

declare(strict_types=1);

namespace App\Http\Access\Directory;

use App\Entity\User;
use App\Http\Access\Grants;
use App\Http\Access\Interfaces\MembershipDirectoryInterface;
use Symfony\Component\Uid\Uuid;

/** Until organisations exist (sc-65) nobody is a member of one, so every organisation route refuses. */
final readonly class NoMemberships implements MembershipDirectoryInterface
{
    public function grantsIn(User $user, Uuid $organisationId): ?Grants
    {
        return null;
    }
}
