<?php

declare(strict_types=1);

namespace App\Domain\User\Phone;

final readonly class ParsedPhone
{
    /**
     * @param non-empty-string $number      E.164
     * @param non-empty-string $countryCode
     */
    public function __construct(
        public string $number,
        public string $countryCode,
    ) {
    }
}
