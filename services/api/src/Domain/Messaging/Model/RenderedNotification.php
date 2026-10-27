<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

/** What one channel sends one person, already in their language. */
final readonly class RenderedNotification
{
    public function __construct(
        public string $subject,
        public string $body,
    ) {
    }
}
