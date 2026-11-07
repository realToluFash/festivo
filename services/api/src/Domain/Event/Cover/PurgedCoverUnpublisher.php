<?php

declare(strict_types=1);

namespace App\Domain\Event\Cover;

use App\Deletion\Interfaces\PurgedFileRemoverInterface;
use DateTimeImmutable;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\Types\Types;
use Psl\Type;

/** Unpublishes the cover photos of the events a purge takes, its own or its organisation's, which would otherwise stay public (sc-3592). */
final readonly class PurgedCoverUnpublisher implements PurgedFileRemoverInterface
{
    public function __construct(
        private Connection $connection,
        private EventCoverEditor $eventCoverEditor,
    ) {
    }

    public function purgedBy(DateTimeImmutable $cutoff): array
    {
        return Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn(
            <<<'SQL'
                SELECT c.photo_key
                FROM event_covers c
                JOIN events e ON e.id = c.event_id
                JOIN organisations o ON o.id = e.organisation_id
                WHERE e.deleted_at <= :cutoff OR o.deleted_at <= :cutoff
                SQL,
            ['cutoff' => $cutoff],
            ['cutoff' => Types::DATETIME_IMMUTABLE],
        ));
    }

    public function remove(array $keys): void
    {
        foreach ($keys as $photoKey) {
            $this->eventCoverEditor->unpublish($photoKey);
        }
    }
}
