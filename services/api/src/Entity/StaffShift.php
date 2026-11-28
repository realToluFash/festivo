<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** When a job is worked, by how many people, and who (sc-3908). Its times are wall-clock times in the event's zone, as the organiser entered them. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'staff_shifts')]
class StaffShift
{
    use Timestampable;

    public const int NEEDED_MAXIMUM = 50;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: StaffJob::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private StaffJob $job;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $startsAt;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $endsAt;

    #[ORM\Column(type: Types::INTEGER)]
    private int $needed;

    /** @var Collection<int, StaffMember> */
    #[ORM\ManyToMany(targetEntity: StaffMember::class)]
    #[ORM\JoinTable(name: 'staff_shift_people')]
    #[ORM\JoinColumn(name: 'shift_id', onDelete: 'CASCADE')]
    #[ORM\InverseJoinColumn(name: 'staff_member_id', onDelete: 'CASCADE')]
    private Collection $people;

    public function __construct(StaffJob $job, DateTimeImmutable $startsAt, DateTimeImmutable $endsAt, int $needed)
    {
        $this->id = Uuid::v7();
        $this->job = $job;
        $this->startsAt = $startsAt;
        $this->endsAt = $endsAt;
        $this->needed = $needed;
        $this->people = new ArrayCollection();
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getJob(): StaffJob
    {
        return $this->job;
    }

    public function getStartsAt(): DateTimeImmutable
    {
        return $this->startsAt;
    }

    public function setStartsAt(DateTimeImmutable $startsAt): void
    {
        $this->startsAt = $startsAt;
    }

    public function getEndsAt(): DateTimeImmutable
    {
        return $this->endsAt;
    }

    public function setEndsAt(DateTimeImmutable $endsAt): void
    {
        $this->endsAt = $endsAt;
    }

    public function getNeeded(): int
    {
        return $this->needed;
    }

    public function setNeeded(int $needed): void
    {
        $this->needed = $needed;
    }

    /** @return list<StaffMember> */
    public function getPeople(): array
    {
        return $this->people->getValues();
    }

    /** @param list<StaffMember> $people */
    public function setPeople(array $people): void
    {
        $this->people = new ArrayCollection($people);
    }
}
