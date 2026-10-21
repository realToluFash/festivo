<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover\Model;

/** A field naming the one person responsible for something in an organisation: an association to User on an entity that has an `organisation`. */
final readonly class ResponsibleField
{
    /**
     * @param class-string $entity
     * @param string       $kind   names the thing in the handover summary, as `handover.kind.<kind>` in the emails catalogue
     */
    public function __construct(
        public string $entity,
        public string $property,
        public string $kind,
        public string $titleProperty,
    ) {
    }
}
