<?php

declare(strict_types=1);

namespace App\Domain\Menu\Model;

/** What a dish last cost (sc-100), in its currency's ISO 4217 minor unit. */
final readonly class LastPrice
{
    public function __construct(
        public int $minor,
        public string $currency,
    ) {
    }
}
