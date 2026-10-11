<?php

declare(strict_types=1);

namespace App\Doctrine;

use Doctrine\ORM\Mapping\ClassMetadata;
use Doctrine\ORM\Query\Filter\SQLFilter;

/**
 * Deleted rows are absent by default, everywhere.
 *
 * Excluding them at each query is a rule every read has to remember, and the
 * one that forgets leaks a deleted guest into a list — which reads as the
 * deletion not having worked. A default that has to be opted OUT of is the only
 * version of this that holds.
 *
 * Disabling it is deliberate and visible:
 *
 *     $em->getFilters()->disable('soft_delete');
 */
final class SoftDeleteFilter extends SQLFilter
{
    public function addFilterConstraint(ClassMetadata $targetEntity, string $targetTableAlias): string
    {
        if (!$this->isSoftDeletable($targetEntity)) {
            return '';
        }

        return sprintf('%s.deleted_at IS NULL', $targetTableAlias);
    }

    private function isSoftDeletable(ClassMetadata $metadata): bool
    {
        $traits = [];
        $class = $metadata->getReflectionClass();

        while (false !== $class) {
            $traits = [...$traits, ...array_keys($class->getTraits())];
            $class = $class->getParentClass();
        }

        return \in_array(SoftDeletable::class, $traits, true);
    }
}
