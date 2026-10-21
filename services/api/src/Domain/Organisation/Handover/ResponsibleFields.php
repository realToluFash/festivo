<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover;

use App\Domain\Organisation\Handover\Model\ResponsibleField;

/** Every field that makes somebody responsible for something: a new one joins this list, or ResponsibleFieldsTest fails. */
final readonly class ResponsibleFields
{
    /** @return list<ResponsibleField> */
    public static function all(): array
    {
        return [];
    }
}
