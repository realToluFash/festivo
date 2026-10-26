<?php

declare(strict_types=1);

namespace App\Enum;

use App\Entity\Event;
use App\Entity\Organisation;

/** Each thing a person can delete and support can restore inside the one window, then purged (sc-68, sc-3592). */
enum DeletedKind: string
{
    case Organisation = 'organisation';
    case Event = 'event';

    /** @return class-string */
    public function entity(): string
    {
        return match ($this) {
            self::Organisation => Organisation::class,
            self::Event => Event::class,
        };
    }

    /** Every table beneath it declares ON DELETE CASCADE to this one, so one DELETE purges the lot. */
    public function table(): string
    {
        return match ($this) {
            self::Organisation => 'organisations',
            self::Event => 'events',
        };
    }

    public function subjectType(): string
    {
        return match ($this) {
            self::Organisation => 'Organisation',
            self::Event => 'Event',
        };
    }

    /** What must be restored before it can be: an event restored inside a deleted organisation would still be out of everybody's sight. */
    public function container(object $deleted): ?object
    {
        return $deleted instanceof Event ? $deleted->getOrganisation() : null;
    }

    public function containerKind(): ?self
    {
        return match ($this) {
            self::Organisation => null,
            self::Event => self::Organisation,
        };
    }

    public function restored(): string
    {
        return $this->value . '.restored';
    }

    public function purged(): string
    {
        return $this->value . '.purged';
    }
}
