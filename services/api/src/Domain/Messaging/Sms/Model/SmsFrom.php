<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Sms\Model;

/** What a text goes from: Soirely's number, or its registered alphanumeric id, which can't take a reply. */
final readonly class SmsFrom
{
    public function __construct(
        public string $sender,
        public bool $takesReplies,
    ) {
    }
}
