<?php

declare(strict_types=1);

namespace App\Domain\User\Attempts;

use App\Http\Exception\ApiException;

/** A check's answer for a wrong secret: it costs the budget, and this is the refusal the person sees. */
final readonly class WrongSecret
{
    public function __construct(
        public ApiException $refusal,
    ) {
    }
}
