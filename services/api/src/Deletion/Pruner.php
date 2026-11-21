<?php

declare(strict_types=1);

namespace App\Deletion;

use App\Audit\Auditor;
use App\Deletion\Interfaces\PurgedFileRemoverInterface;
use App\Deletion\Interfaces\PurgedRowRemoverInterface;
use App\Enum\DeletedKind;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\ArrayParameterType;
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
    /**
     * @param iterable<PurgedFileRemoverInterface> $purgedFileRemovers
     * @param iterable<PurgedRowRemoverInterface>  $purgedRowRemovers
     */
    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
        #[AutowireIterator(PurgedFileRemoverInterface::TAG)]
        private iterable $purgedFileRemovers,
        #[AutowireIterator(PurgedRowRemoverInterface::TAG)]
        private iterable $purgedRowRemovers,
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
        foreach ($this->purgedFileRemovers as $remover) {
            $files[] = [$remover, $remover->purgedBy($cutoff)];
        }

        foreach (DeletedKind::cases() as $kind) {
            $count += $this->connection->transactional(function () use ($kind, $cutoff): int {
                $ids = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
                    Str\format('SELECT id FROM %s WHERE deleted_at <= :cutoff FOR UPDATE', $kind->table()),
                    ['cutoff' => $cutoff],
                    ['cutoff' => Types::DATETIME_IMMUTABLE],
                ));

                foreach ($ids as $id) {
                    $this->auditor->record($kind->purged(), $kind->subjectType(), Uuid::fromString($id));
                }

                $this->connection->executeStatement(
                    Str\format('DELETE FROM %s WHERE id IN (:ids)', $kind->table()),
                    ['ids' => $ids],
                    ['ids' => ArrayParameterType::STRING],
                );

                return Iter\count($ids);
            });
        }

        foreach ($this->purgedRowRemovers as $remover) {
            $remover->remove();
        }

        $this->entityManager->flush();

        foreach ($files as [$remover, $keys]) {
            $remover->remove($keys);
        }

        return $count;
    }

    private function cutoff(): DateTimeImmutable
    {
        return $this->clock->now()->sub(new DateInterval(RestoreWindow::LENGTH));
    }
}
