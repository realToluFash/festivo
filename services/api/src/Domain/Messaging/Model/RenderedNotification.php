<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

/** What one channel sends one person, already in their language. Only the bell draws `lines` as rows, opens `place` and keeps a `thread`. */
final readonly class RenderedNotification
{
    /**
     * @param list<string> $lines        one per line under the subject, already in order
     * @param ?string      $thread       the member's one unread item it updates rather than adding another; with an empty subject, it removes that item
     * @param ?string      $threadFrom   the source an item it starts begins with
     * @param bool         $reopens      the thread keeps one item, read or unread: a new one turns the member's read item unread again and leaves no other (sc-4331)
     * @param bool         $quiet        only rewrites the member's unread item in the thread, neither re-dating nor announcing it
     * @param bool         $silent       a push to the app alone, on its silent channel and passive on iOS: the run-of-show card (sc-66580)
     * @param ?string      $unsubscribe  an email's one-click unsubscribe URL (RFC 8058), sent as its List-Unsubscribe
     * @param ?string      $senderName   an email's From name, "{organisation} via Soirely" for a guest's notice (sc-3942)
     * @param bool         $notYetUrgent an Event day push sent over 24 hours before the person's start, which goes as an ordinary push (sc-4333)
     */
    public function __construct(
        public string $subject,
        public string $body,
        public array $lines = [],
        public ?string $place = null,
        public ?string $thread = null,
        public ?string $threadFrom = null,
        public bool $quiet = false,
        public bool $silent = false,
        public ?string $unsubscribe = null,
        public bool $reopens = false,
        public ?string $senderName = null,
        public bool $notYetUrgent = false,
    ) {
    }
}
