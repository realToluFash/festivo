<?php

declare(strict_types=1);

namespace App\Entity;

use App\Doctrine\Traits\Timestampable;
use App\Enum\MealAnswerKind;
use App\Enum\MenuChangeWhy;
use DateTimeImmutable;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Psl\Str;
use Psl\Vec;
use Symfony\Component\Uid\Uuid;

/** One person's answer to one course (sc-3907), with the allergens they had when it was made: one recorded since serves a chosen pick as needs the host. A pick the host made for them names the host and the time, and the allergens the host confirmed despite the record (sc-3909). */
#[ORM\Entity]
#[ORM\HasLifecycleCallbacks]
#[ORM\Table(name: 'meal_answers')]
#[ORM\UniqueConstraint(name: 'uniq_meal_answer', columns: ['guest_id', 'course_id'])]
#[ORM\Index(name: 'idx_meal_answer_dish', columns: ['dish_id'])]
class MealAnswer
{
    use Timestampable;

    #[ORM\Id]
    #[ORM\Column(type: 'uuid')]
    private Uuid $id;

    #[ORM\ManyToOne(targetEntity: Guest::class)]
    #[ORM\JoinColumn(name: 'guest_id', nullable: false, onDelete: 'CASCADE')]
    private Guest $person;

    #[ORM\ManyToOne(targetEntity: MenuCourse::class)]
    #[ORM\JoinColumn(name: 'course_id', nullable: false, onDelete: 'CASCADE')]
    private MenuCourse $course;

    #[ORM\Column(type: Types::STRING, length: 16, enumType: MealAnswerKind::class)]
    private MealAnswerKind $kind;

    #[ORM\ManyToOne(targetEntity: MenuDish::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?MenuDish $dish;

    #[ORM\ManyToOne(targetEntity: MenuDishVariant::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'CASCADE')]
    private ?MenuDishVariant $variant;

    /** @var list<string> the options' ids, each choice's in its order */
    #[ORM\Column(type: Types::JSON)]
    private array $options;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $allergensAtPick;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    private ?User $chosenBy = null;

    #[ORM\Column(type: Types::STRING, length: 200, nullable: true)]
    private ?string $chosenByName = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?DateTimeImmutable $chosenAt = null;

    /** @var list<string> */
    #[ORM\Column(type: Types::JSON)]
    private array $overridden = [];

    /** The dish's name as they picked it, kept while a menu change asks them again (sc-3913), since the dish may be gone. */
    #[ORM\Column(type: Types::STRING, length: 200, nullable: true)]
    private ?string $changedFrom = null;

    #[ORM\Column(type: Types::STRING, length: 16, nullable: true, enumType: MenuChangeWhy::class)]
    private ?MenuChangeWhy $changedWhy = null;

    #[ORM\Column(type: Types::SMALLINT, nullable: true)]
    private ?int $changedWays = null;

    /** @var list<string> the allergens added to their pick that they have recorded, which put them in Needs the host */
    #[ORM\Column(type: Types::JSON)]
    private array $changedAllergens = [];

    /**
     * @param list<string> $options
     * @param list<string> $allergensAtPick
     */
    public function __construct(Guest $person, MenuCourse $course, MealAnswerKind $kind, ?MenuDish $dish, ?MenuDishVariant $variant, array $options, array $allergensAtPick)
    {
        $this->id = Uuid::v7();
        $this->person = $person;
        $this->course = $course;
        $this->kind = $kind;
        $this->dish = $dish;
        $this->variant = $variant;
        $this->options = $options;
        $this->allergensAtPick = $allergensAtPick;
    }

    public function getId(): Uuid
    {
        return $this->id;
    }

    public function getPerson(): Guest
    {
        return $this->person;
    }

    public function getCourse(): MenuCourse
    {
        return $this->course;
    }

    public function getKind(): MealAnswerKind
    {
        return $this->kind;
    }

    public function getDish(): ?MenuDish
    {
        return $this->dish;
    }

    public function getVariant(): ?MenuDishVariant
    {
        return $this->variant;
    }

    /** @return list<string> */
    public function getOptions(): array
    {
        return $this->options;
    }

    /** @return list<string> */
    public function getAllergensAtPick(): array
    {
        return $this->allergensAtPick;
    }

    /**
     * @param list<string> $options
     * @param list<string> $allergensAtPick
     */
    public function answer(MealAnswerKind $kind, ?MenuDish $dish, ?MenuDishVariant $variant, array $options, array $allergensAtPick): void
    {
        $this->kind = $kind;
        $this->dish = $dish;
        $this->variant = $variant;
        $this->options = $options;
        $this->allergensAtPick = $allergensAtPick;
        $this->chosenBy = null;
        $this->chosenByName = null;
        $this->chosenAt = null;
        $this->overridden = [];
        $this->changedFrom = null;
        $this->changedWhy = null;
        $this->changedWays = null;
        $this->changedAllergens = [];
    }

    /**
     * The pick is let go, so the kitchen counts it on no item, and only its dish's name stays for their RSVP.
     *
     * @param list<string> $allergens
     */
    public function askAgain(MenuChangeWhy $why, ?int $ways = null, array $allergens = []): void
    {
        $name = null === $this->dish ? $this->changedFrom ?? '' : Str\join(Vec\filter_nulls([$this->dish->getName(), $this->variant?->getName()]), ', ');
        $this->answer(MealAnswerKind::MenuChanged, null, null, [], $this->allergensAtPick);
        $this->changedFrom = $name;
        $this->changedWhy = $why;
        $this->changedWays = $ways;
        $this->changedAllergens = $allergens;
    }

    /** Their variant was the last but one removed, so the dish now serves them as it is (sc-3903). */
    public function foldWay(): void
    {
        $this->variant = null;
    }

    public function getChangedFrom(): ?string
    {
        return $this->changedFrom;
    }

    public function getChangedWhy(): ?MenuChangeWhy
    {
        return $this->changedWhy;
    }

    public function getChangedWays(): ?int
    {
        return $this->changedWays;
    }

    /** @return list<string> */
    public function getChangedAllergens(): array
    {
        return $this->changedAllergens;
    }

    /**
     * @param list<string> $options
     * @param list<string> $allergensAtPick
     * @param list<string> $overridden      the person's allergens on the plate the host confirmed despite the record
     */
    public function answerForThem(MealAnswerKind $kind, ?MenuDish $dish, ?MenuDishVariant $variant, array $options, array $allergensAtPick, User $host, DateTimeImmutable $at, array $overridden): void
    {
        $this->answer($kind, $dish, $variant, $options, $allergensAtPick);
        $this->chosenBy = $host;
        $this->chosenByName = $host->getName();
        $this->chosenAt = $at;
        $this->overridden = $overridden;
    }

    public function getChosenBy(): ?User
    {
        return $this->chosenBy;
    }

    public function getChosenByName(): ?string
    {
        return $this->chosenByName;
    }

    public function getChosenAt(): ?DateTimeImmutable
    {
        return $this->chosenAt;
    }

    /** @return list<string> */
    public function getOverridden(): array
    {
        return $this->overridden;
    }
}
