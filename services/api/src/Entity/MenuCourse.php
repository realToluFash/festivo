<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Uid\Uuid;

/** One course of an event's menu, in its place in the order (sc-3902). Its served time is the wall-clock time in the event's zone. */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'menu_courses')]
#[ORM\Index(name: 'idx_menu_course_order', columns: ['event_id', 'position'])]
class MenuCourse
{
    use Timestampable;

    public const int NAME_MAXIMUM = 60;

    public const int PER_EVENT_MAXIMUM = 10;

    public const int OWN_ITEMS_MAXIMUM = 3;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Event::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Event $event;

    #[ORM\Column(type: Types::STRING, length: 240)]
    private string $name;

    /** "20:30", or null when no time is set. */
    #[ORM\Column(type: Types::STRING, length: 5, nullable: true)]
    private ?string $servedAt;

    #[ORM\Column(type: Types::SMALLINT)]
    private int $position;

    /** False is Everyone gets the same: one dish, nothing asked. */
    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $guestsChoose = true;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $skippable = false;

    /** @var list<string> Served with this course: on every plate of it, after the dish's items (sc-34230) */
    #[ORM\Column(type: Types::JSON, options: ['default' => '[]'])]
    private array $ownItems = [];

    /** The plate given at the choose-by date to anyone coming with no answer (sc-1362): set together with the date, or neither is. */
    #[ORM\ManyToOne(targetEntity: MenuDish::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?MenuDish $defaultDish = null;

    #[ORM\ManyToOne(targetEntity: MenuDishVariant::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?MenuDishVariant $defaultVariant = null;

    /** @var list<string> the default's options' ids, each required choice's in its order */
    #[ORM\Column(type: Types::JSON, options: ['default' => '[]'])]
    private array $defaultOptions = [];

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $chooseBy = null;

    public function __construct(Event $event, string $name, ?string $servedAt, int $position)
    {
        $this->id = Uuid::v7();
        $this->event = $event;
        $this->name = $name;
        $this->servedAt = $servedAt;
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

    public function getServedAt(): ?string
    {
        return $this->servedAt;
    }

    public function describe(string $name, ?string $servedAt): void
    {
        $this->name = $name;
        $this->servedAt = $servedAt;
    }

    public function getPosition(): int
    {
        return $this->position;
    }

    public function setPosition(int $position): void
    {
        $this->position = $position;
    }

    public function guestsChoose(): bool
    {
        return $this->guestsChoose;
    }

    public function setGuestsChoose(bool $guestsChoose): void
    {
        $this->guestsChoose = $guestsChoose;
    }

    public function isSkippable(): bool
    {
        return $this->skippable;
    }

    public function setSkippable(bool $skippable): void
    {
        $this->skippable = $skippable;
    }

    /** @return list<string> */
    public function getOwnItems(): array
    {
        return $this->ownItems;
    }

    /** @param list<string> $items */
    public function listOwnItems(array $items): void
    {
        $this->ownItems = $items;
    }

    public function getDefaultDish(): ?MenuDish
    {
        return $this->defaultDish;
    }

    public function getDefaultVariant(): ?MenuDishVariant
    {
        return $this->defaultVariant;
    }

    /** @return list<string> */
    public function getDefaultOptions(): array
    {
        return $this->defaultOptions;
    }

    public function getChooseBy(): ?DateTimeImmutable
    {
        return $this->chooseBy;
    }

    /** @param list<string> $options */
    public function giveByDefault(MenuDish $dish, ?MenuDishVariant $variant, array $options, DateTimeImmutable $chooseBy): void
    {
        $this->defaultDish = $dish;
        $this->defaultVariant = $variant;
        $this->defaultOptions = $options;
        $this->chooseBy = $chooseBy;
    }

    public function clearDefault(): void
    {
        $this->defaultDish = null;
        $this->defaultVariant = null;
        $this->defaultOptions = [];
        $this->chooseBy = null;
    }
}
