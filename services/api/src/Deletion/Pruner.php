<?php

declare(strict_types=1);

namespace App\Deletion;

use App\Audit\Auditor;
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
use Symfony\Component\Uid\Uuid;

/** Purges what support can no longer restore, of every kind; what lies beneath each goes with it by the foreign keys' cascade. */
final readonly class Pruner
{
    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
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

        foreach (DeletedKind::cases() as $kind) {
            $ids = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
                Str\format('DELETE FROM %s WHERE deleted_at <= :cutoff RETURNING id', $kind->table()),
                ['cutoff' => $this->cutoff()],
                ['cutoff' => Types::DATETIME_IMMUTABLE],
            ));

            foreach ($ids as $id) {
                $this->auditor->record($kind->purged(), $kind->subjectType(), Uuid::fromString($id));
            }

            $count += Iter\count($ids);
        }

        $this->entityManager->flush();

        return $count;
    }

    private function cutoff(): DateTimeImmutable
    {
        return $this->clock->now()->sub(new DateInterval(RestoreWindow::LENGTH));
    }
}
