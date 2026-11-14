<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\NotificationPreference;
use App\Entity\User;
use App\Enum\NotificationCategory;
use App\Enum\NotificationChannel;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<NotificationPreference> */
final class NotificationPreferenceRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, NotificationPreference::class);
    }

    public function findOneFor(Uuid $userId, NotificationCategory $category, NotificationChannel $channel): ?NotificationPreference
    {
        return $this->findOneBy(['user' => $userId, 'category' => $category, 'channel' => $channel]);
    }

    /** @return list<NotificationPreference> */
    public function findForUser(User $user): array
    {
        return $this->findBy(['user' => $user]);
    }
}
