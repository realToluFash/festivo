<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\MenuCourse;
use App\Entity\ServiceFiring;
use App\Enum\EventStatus;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<ServiceFiring> */
final class ServiceFiringRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ServiceFiring::class);
    }

    /** @return list<ServiceFiring> */
    public function findOfCourse(MenuCourse $course): array
    {
        return $this->findBy(['course' => $course]);
    }

    /** @return list<ServiceFiring> */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['firedAt' => 'ASC']);
    }

    public function anyOn(Event $event): bool
    {
        return null !== $this->findOneBy(['event' => $event]);
    }

    /** @return list<ServiceFiring> */
    public function findAtTable(Event $event, string $tableKey): array
    {
        return $this->findBy(['event' => $event, 'tableKey' => $tableKey]);
    }

    public function findOneAt(MenuCourse $course, string $tableKey): ?ServiceFiring
    {
        return $this->findOneBy(['course' => $course, 'tableKey' => $tableKey]);
    }

    /** @return list<Event> the events with a course fired that are not yet over by `now`; a Draft or a paused one is among them */
    public function findEventsFiredBy(DateTimeImmutable $now): array
    {
        /** @var list<Event> */
        return $this->getEntityManager()->createQueryBuilder()
            ->select('event')
            ->from(Event::class, 'event')
            ->where('event.status <> :ended')
            ->andWhere('event.endsAt > :now')
            ->andWhere('EXISTS (SELECT firing.id FROM ' . ServiceFiring::class . ' firing WHERE firing.event = event)')
            ->setParameter('ended', EventStatus::Ended->value)
            ->setParameter('now', $now)
            ->getQuery()
            ->getResult();
    }
}
