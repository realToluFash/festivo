<?php

declare(strict_types=1);

namespace App\Domain\Billing\Meter;

use App\Repository\EventCoverRepository;
use App\Storage\ObjectStore;
use Doctrine\DBAL\Connection;
use Psl\Type;
use Psr\Clock\ClockInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Uid\Uuid;
use Throwable;

/** An organisation's storage (sc-90252): the bytes the store holds for the files Soirely keeps until a person removes them. Today those are its events' covers, every copy under each photo key. */
final readonly class StorageMeasurer
{
    public function __construct(
        private Connection $connection,
        private EventCoverRepository $eventCoverRepository,
        private ObjectStore $objectStore,
        private UsageMeter $usageMeter,
        private ClockInterface $clock,
        private LoggerInterface $logger,
    ) {
    }

    /** @return int<0, max> the bytes recorded as its storage today */
    public function measure(Uuid $organisationId): int
    {
        $bytes = 0;

        foreach ($this->eventCoverRepository->photoKeysOf($organisationId) as $photoKey) {
            $bytes += $this->objectStore->publishedBytesUnder($photoKey . '/');
        }

        $bytes = Type\uint()->coerce($bytes);
        $this->usageMeter->measureStorage($organisationId, $this->clock->now(), $bytes);

        return $bytes;
    }

    /** @return int how many were measured; one that fails records nothing, so its last measurement stands */
    public function measureAll(): int
    {
        $measured = 0;

        foreach (Type\vec(Type\string())->coerce($this->connection->fetchFirstColumn('SELECT organisation_id FROM subscriptions ORDER BY organisation_id')) as $id) {
            try {
                $this->measure(Uuid::fromString($id));
                ++$measured;
            } catch (Throwable $e) {
                $this->logger->error('An organisation\'s storage could not be measured; its last measurement stands.', ['organisationId' => $id, 'reason' => $e->getMessage(), 'exception' => $e::class]);
            }
        }

        return $measured;
    }
}
