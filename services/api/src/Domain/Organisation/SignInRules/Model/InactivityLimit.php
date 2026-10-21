<?php

declare(strict_types=1);

namespace App\Domain\Organisation\SignInRules\Model;

use App\Entity\Organisation;

final readonly class InactivityLimit
{
    public function __construct(
        public Organisation $organisation,
        public int $days,
    ) {
    }
}
