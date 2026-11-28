<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use App\Entity\User;

final readonly class RegistrationResult
{
    public function __construct(
        public User $user,
        public IssuedTokens $tokens,
    ) {
    }
}
