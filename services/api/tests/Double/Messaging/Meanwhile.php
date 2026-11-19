<?php

declare(strict_types=1);

namespace App\Tests\Double\Messaging;

use Closure;

/** What another request does between the worker's claim and its chunk write, run from the type's send-time check. */
final class Meanwhile
{
    public ?Closure $happens = null;

    public function happen(): void
    {
        $happens = $this->happens;
        $this->happens = null;

        if (null !== $happens) {
            $happens();
        }
    }
}
