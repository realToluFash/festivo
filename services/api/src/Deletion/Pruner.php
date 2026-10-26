<?php

declare(strict_types=1);

namespace App\Deletion;

use App\Audit\Auditor;
use App\Deletion\Interfaces\PurgedFilesInterface;
use App\Enum\DeletedKind;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Str;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;
use Symfony\Component\Uid\Uuid;

/** Purges what support can no longer restore, of every kind; what lies beneath each goes with it by the foreign keys' cascade, and the files it cannot reach are removed after. */
final readonly class Pruner
{
    /** @param iterable<PurgedFilesInterface> $purgedFiles */
    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
        #[AutowireIterator(PurgedFilesInterface::TAG)]
        private iterable $purgedFiles,
    ) {
    }

    public function countPrunable(): int
    {
        $count = 0;

        foreach (DeletedKind::cases() as $kind) {
            $count += Type\int()->coerce($this->connection->fetchOne(
                Str\format('SELECT COUNT(*) FROM %s WHERE deleted_at <= :cutoff', $kind->table()),
                ['cutoff' => $this->cutoff()],
                ['cutoff' => Types::DATETIME_IMMUTABLE],
            ));
        }

        return $count;
    }

    public function prune(): int
    {
        $count = 0;
        $cutoff = $this->cutoff();
        $files = [];
        foreach ($this->purgedFiles as $purgedFiles) {
            $files[] = [$purgedFiles, $purgedFiles->purgedBy($cutoff)];
        }

        foreach (DeletedKind::cases() as $kind) {
            $ids = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
                Str\format('DELETE FROM %s WHERE deleted_at <= :cutoff RETURNING id', $kind->table()),
                ['cutoff' => $cutoff],
                ['cutoff' => Types::DATETIME_IMMUTABLE],
            ));

            foreach ($ids as $id) {
                $this->auditor->record($kind->purged(), $kind->subjectType(), Uuid::fromString($id));
            }

            $count += Iter\count($ids);
        }

        $this->entityManager->flush();

        foreach ($files as [$purgedFiles, $keys]) {
            $purgedFiles->remove($keys);
        }

        return $count;
    }

    private function cutoff(): DateTimeImmutable
    {
        return $this->clock->now()->sub(new DateInterval(RestoreWindow::LENGTH));
    }
}
