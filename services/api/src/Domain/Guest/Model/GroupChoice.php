<?php

declare(strict_types=1);

namespace App\Domain\Guest\Model;

/** The guest form's Group (sc-3775): a group by `id`, a `name` to find or make on save, or neither for no group. With `create`, the name was chosen as a new group, so one already called that is refused rather than joined (sc-5519). */
final readonly class GroupChoice
{
    public function __construct(
        public ?string $id,
        public ?string $name,
        public bool $create = false,
    ) {
    }
}
