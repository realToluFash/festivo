<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** Conditions saved under a name for one event (sc-3957): never the people, and never pointed to by a message, which copies them. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'saved_audiences')]
#[ORM\Index(name: 'IDX_SAVED_AUDIENCE_EVENT', columns: ['event_id'])]
#[ORM\UniqueConstraint(name: 'uniq_saved_audience_name', columns: ['event_id', 'name_key'])]
class SavedAudience
{
    use Timestampable;

    public const int NAME_MAXIMUM = 60;

    public const int MOST_PER_EVENT = 20;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $nameKey;

    /** @var list<array{type: string, groupId?: ?string}> */
    #[ORM\Column(type: Types::JSON, options: ['jsonb' => true])]
    private array $conditions;

    /** @param list<array{type: string, groupId?: ?string}> $conditions */
    public function __construct(Event $event, string $name, string $nameKey, array $conditions)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->name = $name;
        $this->nameKey = $nameKey;
        $this->conditions = $conditions;
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

    public function getNameKey(): string
    {
        return $this->nameKey;
    }

    /** @return list<array{type: string, groupId?: ?string}> */
    public function getConditions(): array
    {
        return $this->conditions;
    }

    public function rename(string $name, string $nameKey): void
    {
        $this->name = $name;
        $this->nameKey = $nameKey;
    }
}
