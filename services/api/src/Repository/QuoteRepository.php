<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\Quote;
use App\Entity\VendorEngagement;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Quote> */
final class QuoteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Quote::class);
    }

    public function findCurrent(VendorEngagement $engagement): ?Quote
    {
        return $this->findOneBy(['engagement' => $engagement, 'supersededAt' => null]);
    }

    /** The vendor's first quote for the event, before any revision: a payment already made cannot be dated before it (sc-88). */
    public function findFirst(VendorEngagement $engagement): ?Quote
    {
        return $this->findOneBy(['engagement' => $engagement], ['id' => 'ASC']);
    }

    /** @return list<Quote> every version on the event, newest first within each engagement */
    public function findOnEvent(Event $event): array
    {
        /** @var list<Quote> */
        return $this->createQueryBuilder('q')
            ->join('q.engagement', 'e')
            ->where('e.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('q.id', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
