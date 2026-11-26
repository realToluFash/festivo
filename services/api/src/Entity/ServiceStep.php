<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Type\MillisecondDateTimeType;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/**
 * One step of a service as undo sees it (sc-4005): what it touched as it was before, and what it made, so a step that moved a tray's plates together is undone as one.
 *
 * @phpstan-type Before array{plates: array<string, array<array-key, mixed>>, trays: array<string, array<array-key, mixed>>, items: array<string, array<array-key, mixed>>}
 * @phpstan-type Made array{plates: list<string>, trays: list<string>, items: list<string>}
 */
#[ORM\Entity]
#[ORM\Table(name: 'service_steps')]
#[ORM\Index(name: 'idx_service_step_event', columns: ['event_id', 'at'])]
class ServiceStep
{
    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 40)]
    private string $kind;

    /** @var list<string> the ids of every plate, tray and item it touched or made */
    #[ORM\Column(type: Types::JSON)]
    private array $subjects;

    /** @var Before */
    #[ORM\Column(type: Types::JSON)]
    private array $before;

    /** @var Made */
    #[ORM\Column(type: Types::JSON)]
    private array $made;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $by;

    #[ORM\Column(type: MillisecondDateTimeType::NAME)]
    private DateTimeImmutable $at;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $undone = false;

    /**
     * @param list<string> $subjects
     * @param Before       $before
     * @param Made         $made
     */
    public function __construct(Event $event, string $kind, array $subjects, array $before, array $made, User $by, DateTimeImmutable $at)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->kind = $kind;
        $this->subjects = $subjects;
        $this->before = $before;
        $this->made = $made;
        $this->by = $by;
        $this->at = $at;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getKind(): string
    {
        return $this->kind;
    }

    /** @return list<string> */
    public function getSubjects(): array
    {
        return $this->subjects;
    }

    /** @return Before */
    public function getBefore(): array
    {
        return $this->before;
    }

    /** @return Made */
    public function getMade(): array
    {
        return $this->made;
    }

    public function getBy(): User
    {
        return $this->by;
    }

    public function getAt(): DateTimeImmutable
    {
        return $this->at;
    }

    public function isUndone(): bool
    {
        return $this->undone;
    }

    public function undo(): void
    {
        $this->undone = true;
    }
}
