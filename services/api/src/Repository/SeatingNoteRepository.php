<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Event;
use App\Entity\SeatingNote;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<SeatingNote> */
final class SeatingNoteRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SeatingNote::class);
    }

    /** @return list<SeatingNote> */
    public function findOnEvent(Event $event): array
    {
        return $this->findBy(['event' => $event], ['id' => 'ASC']);
    }

    public function findOneInEvent(Event $event, Uuid $id): ?SeatingNote
    {
        return $this->findOneBy(['event' => $event, 'id' => $id]);
    }

    /** The pair's note, whichever of the two is named first. */
    public function findOneJoining(Event $event, Uuid $one, Uuid $other): ?SeatingNote
    {
        [$first, $second] = $one->toRfc4122() < $other->toRfc4122() ? [$one, $other] : [$other, $one];

        return $this->findOneBy(['event' => $event, 'guest' => $first, 'otherGuest' => $second]);
    }
}
