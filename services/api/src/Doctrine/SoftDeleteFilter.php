<?php

declare(strict_types=1);

namespace App\Doctrine;

use App\Doctrine\Traits\SoftDeletable;
use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query\Filter\SQLFilter;

// Registered enabled, so deleted rows are absent from every read without
// anybody asking. Seeing them means disabling it deliberately:
// $em->getFilters()->disable('soft_delete'). See docs/architecture/database.md.
final class SoftDeleteFilter extends SQLFilter
{
    public function addFilterConstraint(ClassMetadata $targetEntity, string $targetTableAlias): string
    {
        if (!$this->isSoftDeletable($targetEntity)) {
            return '';
        }

        return \sprintf('%s.deleted_at IS NULL', $targetTableAlias);
    }

    private function isSoftDeletable(ClassMetadata $metadata): bool
    {
        $traits = [];
        $class = $metadata->getReflectionClass();

        while (false !== $class) {
            $traits = [...$traits, ...\array_keys($class->getTraits())];
            $class = $class->getParentClass();
        }

        return \in_array(SoftDeletable::class, $traits, true);
    }
}
