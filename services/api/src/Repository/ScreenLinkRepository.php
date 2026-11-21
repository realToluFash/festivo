<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\ScreenLink;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;

/** @extends ServiceEntityRepository<ScreenLink> */
final class ScreenLinkRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ScreenLink::class);
    }

    /** @return array<string, ScreenLink> the links not yet replaced, by place */
    public function findCurrentOn(Event $event): array
    {
        $links = [];

        foreach ($this->findBy(['event' => $event, 'replacedAt' => null]) as $link) {
            $links[$link->getPlace()] = $link;
        }

        return $links;
    }

    /** @return array<string, DateTimeImmutable> when each place's link was last replaced */
    public function findLastReplacedOn(Event $event): array
    {
        $rows = $this->createQueryBuilder('l')
            ->select('l.place AS place', 'MAX(l.replacedAt) AS replacedAt')
            ->andWhere('l.event = :event')
            ->andWhere('l.replacedAt IS NOT NULL')
            ->setParameter('event', $event)
            ->groupBy('l.place')
            ->getQuery()
            ->getArrayResult();
        $last = [];

        foreach (Type\vec(Type\shape(['place' => Type\string(), 'replacedAt' => Type\string()]))->coerce($rows) as $row) {
            $last[$row['place']] = new DateTimeImmutable($row['replacedAt']);
        }

        return $last;
    }

    /** Joined to its event, so a deleted event's link finds nothing. */
    public function findOneByTokenHash(string $tokenHash): ?ScreenLink
    {
        $link = $this->createQueryBuilder('l')
            ->addSelect('e', 'o')
            ->innerJoin('l.event', 'e')
            ->innerJoin('e.organisation', 'o')
            ->andWhere('l.tokenHash = :hash')
            ->setParameter('hash', $tokenHash)
            ->getQuery()
            ->getOneOrNullResult();

        return $link instanceof ScreenLink ? $link : null;
    }
}
