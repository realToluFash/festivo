<?php

declare(strict_types=1);

namespace App\Http\Access\Policy;

use Attribute;

/** Anybody, with or without an account: sign-in, registration, health. */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
final readonly class PublicAccess implements Policy
{
}
