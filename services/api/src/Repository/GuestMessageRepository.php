<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\GuestMessage;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<GuestMessage> */
final class GuestMessageRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, GuestMessage::class);
    }

    public function findOneOn(Event $event, string $id): ?GuestMessage
    {
        return Uuid::isValid($id) ? $this->findOneBy(['event' => $event, 'id' => $id]) : null;
    }

    /** @return list<GuestMessage> newest first */
    public function findOn(Event $event): array
    {
        /** @var list<GuestMessage> */
        return $this->createQueryBuilder('m')
            ->where('m.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('m.createdAt', 'DESC')
            ->addOrderBy('m.id', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
