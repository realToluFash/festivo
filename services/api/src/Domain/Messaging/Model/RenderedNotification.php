<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

/** What one channel sends one person, already in their language. Only the bell draws `lines` as rows, opens `place` and keeps a `thread`. */
final readonly class RenderedNotification
{
    /**
     * @param list<string> $lines      one per line under the subject, already in order
     * @param ?string      $thread     the member's one unread item it updates rather than adding another; with an empty subject, it removes that item
     * @param ?string      $threadFrom the source an item it starts begins with
     * @param bool         $quiet      only rewrites the member's unread item in the thread, neither re-dating nor announcing it
     */
    public function __construct(
        public string $subject,
        public string $body,
        public array $lines = [],
        public ?string $place = null,
        public ?string $thread = null,
        public ?string $threadFrom = null,
        public bool $quiet = false,
    ) {
    }
}
