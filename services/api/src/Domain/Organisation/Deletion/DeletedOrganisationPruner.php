<?php

declare(strict_types=1);

namespace App\Domain\Organisation\Deletion;

use App\Audit\Auditor;
use DateInterval;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\EntityManagerInterface;
use Psl\Iter;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Symfony\Component\Uid\Uuid;

/** Purges what support can no longer restore: memberships and roles go with each organisation, by the foreign keys' cascade. */
final readonly class DeletedOrganisationPruner
{
    public const string PURGED = 'organisation.purged';

    public function __construct(
        private Connection $connection,
        private EntityManagerInterface $entityManager,
        private Auditor $auditor,
        private ClockInterface $clock,
    ) {
    }

    public function countPrunable(): int
    {
        return Type\int()->coerce($this->connection->fetchOne(
            'SELECT COUNT(*) FROM organisations WHERE deleted_at <= :cutoff',
            ['cutoff' => $this->cutoff()],
            ['cutoff' => Types::DATETIME_IMMUTABLE],
        ));
    }

    public function prune(): int
    {
        $ids = Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            'DELETE FROM organisations WHERE deleted_at <= :cutoff RETURNING id',
            ['cutoff' => $this->cutoff()],
            ['cutoff' => Types::DATETIME_IMMUTABLE],
        ));

        foreach ($ids as $id) {
            $this->auditor->record(self::PURGED, 'Organisation', Uuid::fromString($id));
        }

        $this->entityManager->flush();

        return Iter\count($ids);
    }

    private function cutoff(): DateTimeImmutable
    {
        return $this->clock->now()->sub(new DateInterval(RestoreWindow::LENGTH));
    }
}
