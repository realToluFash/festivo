<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

final readonly class ActionNotices
{
    public function __construct(
        public Notice $guests,
        public Notice $members,
        public Notice $staff,
    ) {
    }
}
