<?php

declare(strict_types=1);

namespace App\Tests\Double;

use Doctrine\ORM\Event\OnFlushEventArgs;
use RuntimeException;

/** Fails the flush that would write an entity of one class, so a test can watch what a rollback leaves. */
final class FailingFlushListener
{
    public int $failures = 0;

    /** @param class-string $entityClass */
    public function __construct(
        private readonly string $entityClass,
    ) {
    }

    public function onFlush(OnFlushEventArgs $args): void
    {
        foreach ($args->getObjectManager()->getUnitOfWork()->getScheduledEntityInsertions() as $entity) {
            if ($entity instanceof $this->entityClass) {
                ++$this->failures;

                throw new RuntimeException('Failed on purpose, to prove the rollback.');
            }
        }
    }
}
