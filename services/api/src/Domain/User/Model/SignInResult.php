<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use App\Entity\User;

final readonly class SignInResult
{
    public function __construct(
        public User $user,
        public IssuedTokens|IssuedChallenge $admission,
    ) {
    }
}
