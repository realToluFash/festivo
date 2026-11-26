<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** A course fired for one serving table (sc-4005); firing itself is sc-4009's. `tableKey` is ServingTable::key. */
#[ORM\Entity]
#[ORM\Table(name: 'service_firings')]
#[ORM\UniqueConstraint(name: 'uniq_service_firing', columns: ['course_id', 'table_key'])]
class ServiceFiring
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\ManyToOne(targetEntity: MenuCourse::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private MenuCourse $course;

    #[ORM\Column(type: Types::STRING, length: 80)]
    private string $tableKey;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE)]
    private DateTimeImmutable $firedAt;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $firedBy;

    public function __construct(MenuCourse $course, string $tableKey, DateTimeImmutable $at, User $by)
    {
        $this->id = Uuid::v7();
        $this->event = $course->getEvent();
        $this->course = $course;
        $this->tableKey = $tableKey;
        $this->firedAt = $at;
        $this->firedBy = $by;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getCourse(): MenuCourse
    {
        return $this->course;
    }

    public function getTableKey(): string
    {
        return $this->tableKey;
    }

    public function getFiredAt(): DateTimeImmutable
    {
        return $this->firedAt;
    }

    public function getFiredBy(): ?User
    {
        return $this->firedBy;
    }
}
