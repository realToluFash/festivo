<?php

declare(strict_types=1);

namespace App\Domain\User\Interfaces;

use App\Entity\User;

/** Whatever was given to an address before any account had proved it, handed to the account that has now. */
interface AddressClaimsInterface
{
    public function claimFor(User $user): void;
}
