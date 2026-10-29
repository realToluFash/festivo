<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

/** What one channel sends one person, already in their language. Only the bell draws `lines` as rows and opens `place`. */
final readonly class RenderedNotification
{
    /** @param list<string> $lines one per line under the subject, already in order */
    public function __construct(
        public string $subject,
        public string $body,
        public array $lines = [],
        public ?string $place = null,
    ) {
    }
}
