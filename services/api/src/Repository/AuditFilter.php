<?php

declare(strict_types=1);

namespace App\Domain\Organisation\AuditLog;

use App\Enum\AuditType;
use DateTimeImmutable;
use Symfony\Component\Uid\Uuid;

/** Which of an organisation's entries to read: never older than the 365 days kept, then narrowed by the filters, which combine (sc-611). */
final readonly class AuditFilter
{
    public function __construct(
        public Uuid $organisationId,
        public DateTimeImmutable $since,
        public ?Uuid $person = null,
        public ?AuditType $type = null,
        public ?Uuid $event = null,
        public ?DateTimeImmutable $from = null,
        public ?DateTimeImmutable $until = null,
    ) {
    }

    public function upTo(DateTimeImmutable $at): self
    {
        $until = null === $this->until || $at < $this->until ? $at : $this->until;

        return new self($this->organisationId, $this->since, $this->person, $this->type, $this->event, $this->from, $until);
    }
}
