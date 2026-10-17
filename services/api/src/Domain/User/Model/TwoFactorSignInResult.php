<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use App\Entity\User;

/** A challenge passed: always tokens, never another challenge. */
final readonly class TwoFactorSignInResult
{
    public function __construct(
        public User $user,
        public IssuedTokens $tokens,
    ) {
    }
}
