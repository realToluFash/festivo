<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\BudgetLine;
use App\Entity\Event;
use App\Entity\PayerPart;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<PayerPart> */
final class PayerPartRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, PayerPart::class);
    }

    /** @return list<PayerPart> every part on the event's lines, removed lines included, in the order they were set */
    public function findOnEvent(Event $event): array
    {
        /** @var list<PayerPart> */
        return $this->createQueryBuilder('p')
            ->join('p.line', 'l')
            ->where('l.event = :event')
            ->setParameter('event', $event->getId(), 'uuid')
            ->orderBy('p.id', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /** @return list<PayerPart> */
    public function findOnLine(BudgetLine $line): array
    {
        return $this->findBy(['line' => $line], ['id' => 'ASC']);
    }
}
