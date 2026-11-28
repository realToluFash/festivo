<?php

declare(strict_types=1);

namespace App\Entity;

use App\Enum\PlateStep;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Whole plates for one table, carried by one waiter (sc-4005). Made when it starts; a started tray is its waiter's. */
#[ORM\Entity]
#[ORM\Table(name: 'service_trays')]
#[ORM\Index(name: 'idx_service_tray_event', columns: ['event_id'])]
class ServiceTray
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    /** The course it was started for; an owed plate of an earlier course may ride it too. */
    #[ORM\ManyToOne(targetEntity: MenuCourse::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private MenuCourse $course;

    #[ORM\Column(type: Types::STRING, length: 80)]
    private string $tableKey;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $waiter;

    /** @var list<array{step: string, at: string, by: string}> */
    #[ORM\Column(type: Types::JSON)]
    private array $steps;

    public function __construct(MenuCourse $course, string $tableKey, User $waiter, DateTimeImmutable $at)
    {
        $this->id = Uuid::v7();
        $this->event = $course->getEvent();
        $this->course = $course;
        $this->tableKey = $tableKey;
        $this->waiter = $waiter;
        $this->steps = [self::step(PlateStep::Start, $at, $waiter)];
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

    public function getWaiter(): User
    {
        return $this->waiter;
    }

    /** @return list<array{step: string, at: string, by: string}> */
    public function getSteps(): array
    {
        return $this->steps;
    }

    public function stepped(PlateStep $step, DateTimeImmutable $at, User $by): void
    {
        $this->steps[] = self::step($step, $at, $by);
    }

    /** @return list<array{step: string, at: string, by: string}> what undo puts back */
    public function snapshot(): array
    {
        return $this->steps;
    }

    /** @param list<array{step: string, at: string, by: string}> $steps */
    public function restore(array $steps): void
    {
        $this->steps = $steps;
    }

    /** @return array{step: string, at: string, by: string} */
    public static function step(PlateStep $step, DateTimeImmutable $at, User $by): array
    {
        return ['step' => $step->value, 'at' => $at->format(\DATE_RFC3339_EXTENDED), 'by' => $by->getId()->toRfc4122()];
    }
}
