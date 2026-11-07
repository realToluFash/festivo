<?php

declare(strict_types=1);

namespace App\Http\Access\Policy;

use Attribute;

/** Any signed-in account, whatever it belongs to. */
#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
final readonly class Authenticated implements Policy
{
}
