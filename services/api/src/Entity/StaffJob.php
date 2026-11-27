<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\StaffAccess;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** What somebody does on the night of one event (sc-3908); its shifts say when. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'staff_jobs')]
#[ORM\UniqueConstraint(name: 'uniq_staff_job_name', columns: ['event_id', 'name_key'])]
class StaffJob
{
    use Timestampable;

    public const int NAME_MAXIMUM = 60;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    /** NameNormaliser::key of the name, so two names differing in case or accents clash. */
    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $nameKey;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: StaffAccess::class)]
    private StaffAccess $access;

    /** The suggested jobs first, in their order, then each added job after them. */
    #[ORM\Column(type: Types::INTEGER)]
    private int $position;

    public function __construct(Event $event, string $name, string $nameKey, StaffAccess $access, int $position)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->name = $name;
        $this->nameKey = $nameKey;
        $this->access = $access;
        $this->position = $position;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name, string $nameKey): void
    {
        $this->name = $name;
        $this->nameKey = $nameKey;
    }

    public function getNameKey(): string
    {
        return $this->nameKey;
    }

    public function getAccess(): StaffAccess
    {
        return $this->access;
    }

    public function setAccess(StaffAccess $access): void
    {
        $this->access = $access;
    }

    public function getPosition(): int
    {
        return $this->position;
    }
}
