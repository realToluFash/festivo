<?php

declare(strict_types=1);

namespace App\Entity;

use DateTimeImmutable;
use DateTimeZone;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** The day the caterer wants final numbers by (sc-30812). Its own row, so setting it never moves the event's version. */
#[ORM\Entity]
#[ORM\Table(name: 'kitchen_final_numbers')]
class KitchenFinalNumbers
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\OneToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, unique: true, onDelete: 'CASCADE')]
    private Event $event;

    /** A day in the event's own zone, at midnight UTC as a DATE column holds it. */
    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $dueOn = null;

    /** Moves with every change to the day, so a subscribed calendar takes the moved entry (sc-3626). */
    #[ORM\Column(type: Types::INTEGER, options: ['default' => 0])]
    private int $revision = 0;

    /** When the sheet first differed from the latest copy (sc-30692); null while it holds every change. It decides when that milestone is due. */
    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $differsSince = null;

    public function __construct(Event $event)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
    }

    public function getEvent(): Event
    {
        return $this->event;
    }

    public function getDueOn(): ?DateTimeImmutable
    {
        return $this->dueOn;
    }

    public function setDueOn(?DateTimeImmutable $day): void
    {
        if ($day?->format('Y-m-d') === $this->dueOn?->format('Y-m-d')) {
            return;
        }

        $this->dueOn = $day;
        ++$this->revision;
    }

    public function getDiffersSince(): ?DateTimeImmutable
    {
        return $this->differsSince;
    }

    public function setDiffersSince(?DateTimeImmutable $moment): void
    {
        if (null === $moment && null === $this->differsSince) {
            return;
        }

        $this->differsSince = $moment?->setTimezone(new DateTimeZone('UTC'));
        ++$this->revision;
    }

    public function getRevision(): int
    {
        return $this->revision;
    }
}
