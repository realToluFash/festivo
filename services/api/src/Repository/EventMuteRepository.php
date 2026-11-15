<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\EventMute;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\ArrayParameterType;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<EventMute> */
final class EventMuteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, EventMute::class);
    }

    public function findOneFor(User $user, Event $event): ?EventMute
    {
        return $this->findOneBy(['user' => $user, 'event' => $event]);
    }

    /**
     * @param list<Uuid> $userIds
     *
     * @return list<string> those of them who muted the event
     */
    public function findMutedAmong(string $eventId, array $userIds): array
    {
        if ([] === $userIds) {
            return [];
        }

        return Vec\map(
            Type\vec(Type\dict(Type\string(), Type\mixed()))->coerce($this->getEntityManager()->getConnection()->fetchAllAssociative(
                'SELECT user_id FROM event_mutes WHERE event_id = :event AND user_id IN (:users)',
                ['event' => $eventId, 'users' => Vec\map($userIds, static fn (Uuid $id): string => $id->toRfc4122())],
                ['users' => ArrayParameterType::STRING],
            )),
            static fn (array $row): string => Type\string()->coerce($row['user_id']),
        );
    }
}
