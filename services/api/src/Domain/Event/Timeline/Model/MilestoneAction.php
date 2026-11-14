<?php

declare(strict_types=1);

namespace App\Domain\Event\Timeline\Model;

/** A way into the area a milestone belongs to: its label, and a path in the client. */
final readonly class MilestoneAction
{
    public function __construct(
        public string $label,
        public string $link,
    ) {
    }
}
