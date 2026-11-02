<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\NotificationItem;
use App\Entity\User;
use DateTimeImmutable;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Psl\Type;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<NotificationItem> */
final class NotificationItemRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, NotificationItem::class);
    }

    /** @return list<NotificationItem> newest first, none older than $since, and after $after in that order when it is given */
    public function findFeedFor(User $user, DateTimeImmutable $since, ?NotificationItem $after, int $limit): array
    {
        $query = $this->createQueryBuilder('item')
            ->where('item.user = :user')
            ->andWhere('item.createdAt >= :since')
            ->setParameter('user', $user)
            ->setParameter('since', $since)
            ->orderBy('item.createdAt', 'DESC')
            ->addOrderBy('item.id', 'DESC')
            ->setMaxResults($limit);

        if (null !== $after) {
            $query->andWhere('item.createdAt < :afterAt OR (item.createdAt = :afterAt AND item.id < :afterId)')
                ->setParameter('afterAt', $after->getCreatedAt())
                ->setParameter('afterId', $after->getId(), 'uuid');
        }

        return Type\vec(Type\instance_of(NotificationItem::class))->coerce($query->getQuery()->getResult());
    }

    public function countUnreadFor(User $user, DateTimeImmutable $since): int
    {
        return Type\int()->coerce($this->createQueryBuilder('item')
            ->select('COUNT(item.id)')
            ->where('item.user = :user')
            ->andWhere('item.createdAt >= :since')
            ->andWhere('item.readAt IS NULL')
            ->setParameter('user', $user)
            ->setParameter('since', $since)
            ->getQuery()
            ->getSingleScalarResult());
    }

    public function findOneForUser(User $user, Uuid $id): ?NotificationItem
    {
        return $this->findOneBy(['id' => $id, 'user' => $user]);
    }
}
