<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover;

use App\Domain\Organisation\Handover\Model\WorkKind;
use App\Entity\EventPerson;

/** Every field that names somebody as responsible for something in an organisation (sc-614): a new one joins this list and WorkFinder, or ResponsibleFieldsTest fails. */
final readonly class ResponsibleFields
{
    /** @return array<string, WorkKind> `Entity::property` to the kind of work it names */
    public static function all(): array
    {
        return [
            EventPerson::class . '::membership' => WorkKind::EventLead,
        ];
    }
}
