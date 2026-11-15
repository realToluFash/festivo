<?php

declare(strict_types=1);

namespace App\Domain\Messaging\Model;

use App\Enum\NotificationAudienceKind;
use Symfony\Component\Uid\Uuid;

/** One person as a channel reaches them, read when the send happens rather than when it was scheduled. */
final readonly class Recipient
{
    public function __construct(
        public NotificationAudienceKind $kind,
        public Uuid $id,
        public string $name,
        public string $locale,
        public ?string $emailAddress,
    ) {
    }
}
