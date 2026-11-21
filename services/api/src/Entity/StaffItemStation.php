<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** The place that dishes one of a course's items (sc-3910). An item with no row is dished at the Pass, and a renamed item is a new one. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'staff_item_stations')]
#[ORM\UniqueConstraint(name: 'uniq_staff_item_station', columns: ['course_id', 'item_key'])]
class StaffItemStation
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: MenuCourse::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private MenuCourse $course;

    /** NameNormaliser::key of the item, as sc-34230 tells one item from another. */
    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $itemKey;

    #[ORM\ManyToOne(targetEntity: StaffStation::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private StaffStation $station;

    public function __construct(MenuCourse $course, string $itemKey, StaffStation $station)
    {
        $this->id = Uuid::v7();
        $this->course = $course;
        $this->itemKey = $itemKey;
        $this->station = $station;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getCourse(): MenuCourse
    {
        return $this->course;
    }

    public function getItemKey(): string
    {
        return $this->itemKey;
    }

    public function getStation(): StaffStation
    {
        return $this->station;
    }

    public function setStation(StaffStation $station): void
    {
        $this->station = $station;
    }
}
