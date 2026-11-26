<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\SavedAudience;
use App\Http\Access\Interfaces\EventScopedRepositoryInterface;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<SavedAudience> */
final class SavedAudienceRepository extends ServiceEntityRepository implements EventScopedRepositoryInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SavedAudience::class);
    }

    public function loads(): string
    {
        return SavedAudience::class;
    }

    public function findOneInEvent(Uuid $eventId, Uuid $id): ?SavedAudience
    {
        return $this->findOneBy(['event' => $eventId, 'id' => $id]);
    }

    /** @return list<SavedAudience> */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event->getId()]);
    }

    public function findOneNamed(Event $event, string $nameKey): ?SavedAudience
    {
        return $this->findOneBy(['event' => $event->getId(), 'nameKey' => $nameKey]);
    }
}
