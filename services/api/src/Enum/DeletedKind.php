<?php

declare(strict_types=1);

namespace App\Enum;

use App\Entity\Organisation;

/** Each thing a person can delete and support can restore inside the one window, then purged (sc-68, sc-3592). */
enum DeletedKind: string
{
    case Organisation = 'organisation';

    /** @return class-string */
    public function entity(): string
    {
        return match ($this) {
            self::Organisation => Organisation::class,
        };
    }

    /** Every table beneath it declares ON DELETE CASCADE to this one, so one DELETE purges the lot. */
    public function table(): string
    {
        return match ($this) {
            self::Organisation => 'organisations',
        };
    }

    public function subjectType(): string
    {
        return match ($this) {
            self::Organisation => 'Organisation',
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
