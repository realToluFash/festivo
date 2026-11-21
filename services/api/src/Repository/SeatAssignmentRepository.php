<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Guest;
use App\Entity\SeatAssignment;
use App\Entity\SeatingPlan;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Uid\Uuid;

/** @extends ServiceEntityRepository<SeatAssignment> */
final class SeatAssignmentRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, SeatAssignment::class);
    }

    /** @return list<SeatAssignment> */
    public function findInPlan(SeatingPlan $plan): array
    {
        return $this->findBy(['plan' => $plan], ['seat' => 'ASC']);
    }

    /** @return list<SeatAssignment> by seat number */
    public function findAt(Uuid $placeId): array
    {
        return $this->findBy(['placeId' => $placeId], ['seat' => 'ASC']);
    }

    public function findOneOf(Guest $guest): ?SeatAssignment
    {
        return $this->findOneBy(['guest' => $guest]);
    }

    /**
     * @param list<Guest> $guests
     *
     * @return list<SeatAssignment>
     */
    public function findOfGuests(array $guests): array
    {
        return [] === $guests ? [] : $this->findBy(['guest' => $guests]);
    }
}
