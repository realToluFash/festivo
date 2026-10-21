<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Handover\Model;

use Symfony\Component\Uid\Uuid;

/** One thing somebody is the named responsible person for. */
final readonly class Responsibility
{
    public function __construct(
        public ResponsibleField $field,
        public Uuid $id,
        public string $title,
    ) {
    }
}
