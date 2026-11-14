<?php

declare(strict_types=1);

namespace App\Domain\User\Mail;

use SensitiveParameter;

/** The code an email carries, so its send stops when the code does and a newer one replaces it. */
final readonly class MailCode
{
    public function __construct(
        #[SensitiveParameter]
        public string $code,
        public int $lifetimeMinutes,
    ) {
    }
}
