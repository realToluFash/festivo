<?php

declare(strict_types=1);

namespace App\Domain\User\Model;

use App\Entity\VerificationChallenge;

final readonly class IssuedVerificationCode
{
    public function __construct(
        public string $code,
        public VerificationChallenge $challenge,
    ) {
    }
}
