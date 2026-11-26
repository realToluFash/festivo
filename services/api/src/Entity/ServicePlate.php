<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Type\MillisecondDateTimeType;
use App\Enum\HeldChoice;
use App\Enum\ItemMark;
use App\Enum\OwedReason;
use App\Enum\PlateStage;
use App\Enum\PlateStep;
use App\Enum\SentBackReason;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Psl\Dict;
use Psl\Iter;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/**
 * An order sent back is owed as itself, so it is not Served until it is served again (sc-4005).
 *
 * @phpstan-type Item array{key: string, name: ?string}
 * @phpstan-type Step array{stage: string, at: string, by: string}
 * @phpstan-type SentBack array{reason: string, at: string, by: string, stage: string, steps: list<Step>}
 * @phpstan-type Snapshot array{stage: string, tray: ?string, marks: array<string, string>, markedAt?: array<string, string>, choice: ?string, toFollow: list<string>, steps: list<Step>, owedReason: ?string, owedAt: ?string, sentBack: list<SentBack>}
 */
#[ORM\Entity]
#[ORM\Table(name: 'service_plates')]
#[ORM\Index(name: 'idx_service_plate_course', columns: ['course_id'])]
#[ORM\Index(name: 'idx_service_plate_table', columns: ['event_id', 'table_key'])]
#[ORM\UniqueConstraint(name: 'uniq_service_order', columns: ['course_id', 'guest_id'], options: ['where' => '(is_order)'])]
class ServicePlate
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

    #[ORM\ManyToOne(targetEntity: Guest::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private Guest $guest;

    #[ORM\Column(type: Types::STRING, length: 80)]
    private string $tableKey;

    #[ORM\Column(type: Types::BOOLEAN)]
    private bool $isOrder;

    /** @var list<Item> in the menu's order */
    #[ORM\Column(type: Types::JSON)]
    private array $items;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: PlateStage::class)]
    private PlateStage $stage = PlateStage::ToServe;

    #[ORM\ManyToOne(targetEntity: ServiceTray::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?ServiceTray $tray = null;

    /** @var array<string, string> ItemMark by item key */
    #[ORM\Column(type: Types::JSON)]
    private array $marks = [];

    /** @var array<string, string> when each mark was made, by item key (sc-4015) */
    #[ORM\Column(type: Types::JSON)]
    private array $markedAt = [];

    #[ORM\Column(type: Types::STRING, length: 16, nullable: true, enumType: HeldChoice::class)]
    private ?HeldChoice $choice = null;

    /** @var list<string> the keys left behind when the plate went on a tray with What's ready, now */
    #[ORM\Column(type: Types::JSON)]
    private array $toFollow = [];

    /** @var list<Step> */
    #[ORM\Column(type: Types::JSON)]
    private array $steps;

    #[ORM\Column(type: Types::STRING, length: 16, nullable: true, enumType: OwedReason::class)]
    private ?OwedReason $owedReason;

    #[ORM\Column(type: MillisecondDateTimeType::NAME, nullable: true)]
    private ?DateTimeImmutable $owedAt;

    /** @var list<SentBack> each time it was sent back, with the stage and steps it had */
    #[ORM\Column(type: Types::JSON)]
    private array $sentBack = [];

    /** The order an owed plate is for; null on an order. */
    #[ORM\ManyToOne(targetEntity: self::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?self $order;

    /** The dish's variant when it is not one of the plate's items, as a child's portion (sc-34230), so a station can say it (sc-4015). */
    #[ORM\Column(type: Types::STRING, length: 240, nullable: true)]
    private ?string $variant;

    /** @param list<Item> $items */
    private function __construct(MenuCourse $course, Guest $guest, string $tableKey, bool $isOrder, array $items, ?string $variant, ?OwedReason $owedReason, ?self $order, DateTimeImmutable $at, User $by)
    {
        $this->variant = $variant;
        $this->id = Uuid::v7();
        $this->event = $course->getEvent();
        $this->course = $course;
        $this->guest = $guest;
        $this->tableKey = $tableKey;
        $this->isOrder = $isOrder;
        $this->items = $items;
        $this->owedReason = $owedReason;
        $this->owedAt = null === $owedReason ? null : $at;
        $this->order = $order;
        $this->steps = [self::step(PlateStage::ToServe, $at, $by)];
    }

    /** @param list<Item> $items */
    public static function order(MenuCourse $course, Guest $guest, string $tableKey, array $items, ?string $variant, DateTimeImmutable $at, User $by): self
    {
        return new self($course, $guest, $tableKey, true, $items, $variant, null, null, $at, $by);
    }

    /** @param list<Item> $items */
    public static function owed(self $from, array $items, OwedReason $reason, DateTimeImmutable $at, User $by): self
    {
        return new self($from->course, $from->guest, $from->tableKey, false, $items, $from->variant, $reason, $from->order ?? $from, $at, $by);
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

    public function getGuest(): Guest
    {
        return $this->guest;
    }

    public function getTableKey(): string
    {
        return $this->tableKey;
    }

    public function isOrder(): bool
    {
        return $this->isOrder;
    }

    public function isOwed(): bool
    {
        return null !== $this->owedReason;
    }

    public function getVariant(): ?string
    {
        return $this->variant;
    }

    /** @return list<Item> */
    public function getItems(): array
    {
        return $this->items;
    }

    /** @return list<Item> what goes on the plate: every item but those left To follow */
    public function onThePlate(): array
    {
        return Vec\filter($this->items, fn (array $item): bool => !Iter\contains($this->toFollow, $item['key']));
    }

    public function getStage(): PlateStage
    {
        return $this->stage;
    }

    public function getTray(): ?ServiceTray
    {
        return $this->tray;
    }

    /** @return array<string, ItemMark> */
    public function getMarks(): array
    {
        return Dict\map($this->marks, ItemMark::from(...));
    }

    /** @return array<string, string> */
    public function getMarkedAt(): array
    {
        return $this->markedAt;
    }

    public function getChoice(): ?HeldChoice
    {
        return $this->choice;
    }

    /** @return list<string> */
    public function getToFollow(): array
    {
        return $this->toFollow;
    }

    /** @return list<Step> */
    public function getSteps(): array
    {
        return $this->steps;
    }

    public function getOwedReason(): ?OwedReason
    {
        return $this->owedReason;
    }

    public function getOwedAt(): ?DateTimeImmutable
    {
        return $this->owedAt;
    }

    /** @return list<SentBack> */
    public function getSentBack(): array
    {
        return $this->sentBack;
    }

    public function getOrder(): ?self
    {
        return $this->order;
    }

    public function choose(HeldChoice $choice): void
    {
        $this->choice = $choice;
    }

    /** @param list<string> $toFollow */
    public function putOn(ServiceTray $tray, array $toFollow, DateTimeImmutable $at, User $by): void
    {
        $this->tray = $tray;
        $this->toFollow = $toFollow;
        $this->moved(PlateStep::Start, $at, $by);
    }

    public function mark(string $itemKey, ?ItemMark $mark, DateTimeImmutable $at): void
    {
        if (null === $mark) {
            unset($this->marks[$itemKey], $this->markedAt[$itemKey]);
        } else {
            $this->marks[$itemKey] = $mark->value;
            $this->markedAt[$itemKey] = $at->format(\DATE_RFC3339_EXTENDED);
        }
    }

    public function moved(PlateStep $step, DateTimeImmutable $at, User $by): void
    {
        $this->stage = PlateStage::after($step);
        $this->steps[] = self::step($this->stage, $at, $by);
    }

    /** Back to To serve, its marks cleared, and off its tray. An order taken off keeps the items it had To follow for the next choice. */
    public function takeOff(DateTimeImmutable $at, User $by): void
    {
        $this->tray = null;
        $this->marks = [];
        $this->markedAt = [];
        $this->toFollow = [];
        $this->moved(PlateStep::TakeOff, $at, $by);
    }

    public function sendBack(SentBackReason $reason, DateTimeImmutable $at, User $by): void
    {
        $this->sentBack[] = ['reason' => $reason->value, 'at' => $at->format(\DATE_RFC3339_EXTENDED), 'by' => $by->getId()->toRfc4122(), 'stage' => $this->stage->value, 'steps' => $this->steps];
        $this->tray = null;
        $this->marks = [];
        $this->markedAt = [];
        $this->toFollow = [];
        $this->choice = null;
        $this->owedReason = OwedReason::SentBack;
        $this->owedAt = $at;
        $this->moved(PlateStep::SendBack, $at, $by);
    }

    /** @return Snapshot */
    public function snapshot(): array
    {
        return [
            'stage' => $this->stage->value,
            'tray' => $this->tray?->getId()->toRfc4122(),
            'marks' => $this->marks,
            'markedAt' => $this->markedAt,
            'choice' => $this->choice?->value,
            'toFollow' => $this->toFollow,
            'steps' => $this->steps,
            'owedReason' => $this->owedReason?->value,
            'owedAt' => $this->owedAt?->format(\DATE_RFC3339_EXTENDED),
            'sentBack' => $this->sentBack,
        ];
    }

    /** @param Snapshot $snapshot */
    public function restore(array $snapshot, ?ServiceTray $tray): void
    {
        $this->stage = PlateStage::from($snapshot['stage']);
        $this->tray = $tray;
        $this->marks = $snapshot['marks'];
        $this->markedAt = $snapshot['markedAt'] ?? [];
        $this->choice = null === $snapshot['choice'] ? null : HeldChoice::from($snapshot['choice']);
        $this->toFollow = $snapshot['toFollow'];
        $this->steps = $snapshot['steps'];
        $this->owedReason = null === $snapshot['owedReason'] ? null : OwedReason::from($snapshot['owedReason']);
        $this->owedAt = null === $snapshot['owedAt'] ? null : new DateTimeImmutable($snapshot['owedAt']);
        $this->sentBack = $snapshot['sentBack'];
    }

    /** @return Step */
    private static function step(PlateStage $stage, DateTimeImmutable $at, User $by): array
    {
        return ['stage' => $stage->value, 'at' => $at->format(\DATE_RFC3339_EXTENDED), 'by' => $by->getId()->toRfc4122()];
    }
}
