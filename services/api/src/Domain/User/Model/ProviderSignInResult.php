<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use App\Entity\User;

final readonly class ProviderSignInResult
{
    public function __construct(
        public User $user,
        public IssuedTokens|IssuedChallenge $admission,
        /** The provider was linked to an existing account just now, which the person is told once. */
        public bool $linked,
    ) {
    }
}
